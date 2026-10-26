// Resumen del análisis de SonarQube: arma reports/sonarqube/summary.json con las respuestas
// de la API y lo convierte en markdown. Lo usan tools/sonarqube/run.mjs (resumen del job) y
// tools/evidence/build-comment.mjs (sección del comentario del PR).
//
// Funciones puras: no llaman a la API ni leen archivos, así se prueban con datos de ejemplo.

/** Métricas que se exportan. Los nombres son los de la API de SonarQube. */
export const METRIC_KEYS = [
  'bugs',
  'vulnerabilities',
  'code_smells',
  'security_hotspots',
  'coverage',
  'duplicated_lines_density',
  'ncloc',
  'reliability_rating',
  'security_rating',
  'sqale_rating',
]

/** Nombre en español de cada métrica, para tablas y mensajes. */
export const METRIC_LABELS = {
  bugs: 'Bugs',
  vulnerabilities: 'Vulnerabilidades',
  code_smells: 'Code smells',
  security_hotspots: 'Security hotspots por revisar',
  coverage: 'Cobertura de los tests unitarios',
  duplicated_lines_density: 'Líneas duplicadas',
  ncloc: 'Líneas de código',
  reliability_rating: 'Nota de confiabilidad',
  security_rating: 'Nota de seguridad',
  sqale_rating: 'Nota de mantenibilidad',
}

const PERCENT_METRICS = new Set(['coverage', 'duplicated_lines_density'])
const RATING_METRICS = new Set(['reliability_rating', 'security_rating', 'sqale_rating'])
const RATINGS = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' }

const SEVERITY_TEXT = {
  BLOCKER: 'bloqueante',
  CRITICAL: 'crítica',
  MAJOR: 'mayor',
  MINOR: 'menor',
  INFO: 'informativa',
}
const SEVERITY_ORDER = Object.keys(SEVERITY_TEXT)
const TYPE_TEXT = { BUG: 'Bug', VULNERABILITY: 'Vulnerabilidad', CODE_SMELL: 'Code smell' }
const PROBABILITY_TEXT = { HIGH: 'alta', MEDIUM: 'media', LOW: 'baja' }

/** Convierte el valor de texto de la API en número, o en letra A a E si es una nota. */
function parseMeasure(metric, value) {
  if (value === undefined || value === null || value === '') return null
  if (RATING_METRICS.has(metric)) return RATINGS[Math.round(Number(value))] ?? null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** "projectKey:backend/src/a.ts" a "backend/src/a.ts" */
const fileOf = (component = '') => component.slice(component.indexOf(':') + 1)

const bySeverity = (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)

/**
 * Junta las respuestas de la API en un resumen estable y fácil de leer.
 * @param {object} input
 * @param {{ key: string, name: string }} input.project
 * @param {string} [input.serverVersion] respuesta de /api/system/status
 * @param {{ name: string, conditions: object[] }} input.gate quality gate creada por run.mjs
 * @param {object} input.projectStatus respuesta de /api/qualitygates/project_status
 * @param {object} input.measures respuesta de /api/measures/component
 * @param {object} input.issues respuesta de /api/issues/search
 * @param {object} input.hotspots respuesta de /api/hotspots/search
 * @param {number} [input.top] cuántos issues y hotspots se guardan
 */
export function buildSummary({
  project,
  serverVersion,
  gate,
  projectStatus,
  measures,
  issues,
  hotspots,
  top = 10,
}) {
  const values = Object.fromEntries(
    (measures?.component?.measures ?? []).map((m) => [m.metric, m.value]),
  )
  const metrics = Object.fromEntries(
    METRIC_KEYS.map((metric) => [metric, parseMeasure(metric, values[metric])]),
  )

  const actual = new Map(
    (projectStatus?.projectStatus?.conditions ?? []).map((c) => [c.metricKey, c]),
  )
  const conditions = (gate?.conditions ?? []).map((condition) => {
    const result = actual.get(condition.metric)
    return {
      metric: condition.metric,
      label: METRIC_LABELS[condition.metric] ?? condition.metric,
      comparator: condition.op,
      threshold: condition.error,
      actual: result?.actualValue ?? values[condition.metric] ?? null,
      status: result?.status ?? 'NONE',
    }
  })

  const topIssues = (issues?.issues ?? [])
    .map((issue) => ({
      severity: issue.severity,
      type: issue.type,
      rule: issue.rule,
      message: issue.message,
      file: fileOf(issue.component),
      line: issue.line ?? null,
    }))
    .sort(bySeverity)
    .slice(0, top)

  const topHotspots = (hotspots?.hotspots ?? []).slice(0, top).map((hotspot) => ({
    probability: hotspot.vulnerabilityProbability,
    category: hotspot.securityCategory,
    rule: hotspot.ruleKey,
    message: hotspot.message,
    file: fileOf(hotspot.component),
    line: hotspot.line ?? null,
  }))

  return {
    project,
    serverVersion: serverVersion ?? null,
    qualityGate: {
      name: gate?.name ?? null,
      status: projectStatus?.projectStatus?.status ?? 'NONE',
      conditions,
    },
    metrics,
    issues: { total: issues?.total ?? issues?.paging?.total ?? 0, top: topIssues },
    hotspots: { total: hotspots?.paging?.total ?? 0, top: topHotspots },
  }
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const decimal = (value) => String(Math.round(value * 10) / 10).replace('.', ',')

/** Valor de una métrica listo para mostrar: "87,3 %", "1.234", "A". */
export function formatMetric(metric, value) {
  if (value === null || value === undefined || value === '') return 'sin dato'
  // Las notas llegan como letra (summary.metrics) o como número 1 a 5 (condiciones de la gate)
  if (RATING_METRICS.has(metric)) return RATINGS[Math.round(Number(value))] ?? String(value)
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  if (PERCENT_METRICS.has(metric)) return `${decimal(number)} %`
  return number.toLocaleString('es-CL')
}

function thresholdText(condition) {
  const value = formatMetric(condition.metric, condition.threshold)
  // En las notas un número mayor es peor: GT 1 significa "peor que A"
  if (RATING_METRICS.has(condition.metric)) return `${value} o mejor`
  // GT: falla si el valor es mayor que el umbral. LT: falla si es menor
  return condition.comparator === 'LT' ? `mínimo ${value}` : `máximo ${value}`
}

const statusIcon = (status) => (status === 'OK' ? '✅' : status === 'ERROR' ? '❌' : '⚪')

/** Texto de una celda de tabla: sin saltos de línea ni barras que rompan la tabla. */
const cell = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()

const where = (item) => `\`${item.file}${item.line ? `:${item.line}` : ''}\``

/**
 * Sección de markdown con la quality gate, las métricas y los principales issues.
 * @returns {string[]} líneas
 */
export function renderSummaryMarkdown(summary) {
  const gate = summary.qualityGate
  const passed = gate.status === 'OK'
  const m = summary.metrics
  const lines = [
    '### 🧹 Calidad de código (SonarQube)',
    '',
    `${statusIcon(gate.status)} **Quality gate ${passed ? 'aprobada' : gate.status === 'ERROR' ? 'reprobada' : 'sin resultado'}**` +
      `${gate.name ? ` (\`${gate.name}\`)` : ''}${summary.serverVersion ? ` · SonarQube Community ${summary.serverVersion}` : ''}`,
    '',
    'La quality gate es la lista de condiciones mínimas que el código debe cumplir para aprobar. ' +
      'SonarQube corrió en un contenedor temporal que se borró al terminar el job: este resumen y el artefacto `sonarqube` son la evidencia.',
    '',
  ]

  if (gate.conditions.length > 0) {
    lines.push('| Condición | Umbral | Valor | Estado |', '| --- | --- | --- | :---: |')
    for (const condition of gate.conditions) {
      lines.push(
        `| ${condition.label} | ${thresholdText(condition)} | ${formatMetric(condition.metric, condition.actual)} | ${statusIcon(condition.status)} |`,
      )
    }
    lines.push('')
  }

  lines.push(
    '| Métrica | Valor |',
    '| --- | --- |',
    `| ${METRIC_LABELS.ncloc} | ${formatMetric('ncloc', m.ncloc)} |`,
    `| ${METRIC_LABELS.bugs} | ${formatMetric('bugs', m.bugs)} (confiabilidad ${formatMetric('reliability_rating', m.reliability_rating)}) |`,
    `| ${METRIC_LABELS.vulnerabilities} | ${formatMetric('vulnerabilities', m.vulnerabilities)} (seguridad ${formatMetric('security_rating', m.security_rating)}) |`,
    `| ${METRIC_LABELS.code_smells} | ${formatMetric('code_smells', m.code_smells)} (mantenibilidad ${formatMetric('sqale_rating', m.sqale_rating)}) |`,
    `| ${METRIC_LABELS.security_hotspots} | ${formatMetric('security_hotspots', m.security_hotspots)} |`,
    `| ${METRIC_LABELS.coverage} | ${formatMetric('coverage', m.coverage)} |`,
    `| ${METRIC_LABELS.duplicated_lines_density} | ${formatMetric('duplicated_lines_density', m.duplicated_lines_density)} |`,
    '',
    'Las notas van de A (mejor) a E. Un code smell es código que funciona pero es difícil de leer o de cambiar.',
    '',
  )

  const issues = summary.issues
  if (issues.top.length > 0) {
    lines.push(
      `<details><summary>Principales issues (${issues.top.length} de ${issues.total}, de mayor a menor severidad)</summary>`,
      '',
      '| Severidad | Tipo | Dónde | Mensaje | Regla |',
      '| --- | --- | --- | --- | --- |',
    )
    for (const issue of issues.top) {
      lines.push(
        `| ${SEVERITY_TEXT[issue.severity] ?? cell(issue.severity)} | ${TYPE_TEXT[issue.type] ?? cell(issue.type)} | ${where(issue)} | ${cell(issue.message)} | \`${issue.rule}\` |`,
      )
    }
    lines.push('', '</details>', '')
  } else {
    lines.push('Sin issues abiertos.', '')
  }

  const hotspots = summary.hotspots
  if (hotspots.top.length > 0) {
    lines.push(
      `<details><summary>Security hotspots por revisar (${hotspots.top.length} de ${hotspots.total})</summary>`,
      '',
      'Un security hotspot es código sensible para la seguridad que una persona debe revisar. No siempre es una vulnerabilidad.',
      '',
      '| Probabilidad | Dónde | Mensaje | Regla |',
      '| --- | --- | --- | --- |',
    )
    for (const hotspot of hotspots.top) {
      lines.push(
        `| ${PROBABILITY_TEXT[hotspot.probability] ?? cell(hotspot.probability)} | ${where(hotspot)} | ${cell(hotspot.message)} | \`${hotspot.rule}\` |`,
      )
    }
    lines.push('', '</details>', '')
  }
  return lines
}
