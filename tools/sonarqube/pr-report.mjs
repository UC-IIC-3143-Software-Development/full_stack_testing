// Resultado del código nuevo de un PR: arma reports/sonarqube/pr.json con las respuestas de la
// API y lo convierte en el comentario que el bot publica en el PR (reports/sonarqube/pr.md).
// Lo usa tools/sonarqube/run.mjs en modo PR (variables BASE_SHA y HEAD_SHA).
//
// Código nuevo: las líneas que el PR agrega o cambia respecto de la rama base. SonarQube lo sabe
// porque analiza primero la base y después el HEAD, y compara con git blame (ver docs/pipeline.md).
//
// Funciones puras: no llaman a la API ni leen archivos, así se prueban con datos de ejemplo.
import {
  METRIC_LABELS,
  SEVERITY_TEXT,
  TYPE_TEXT,
  bySeverity,
  cell,
  fileOf,
  formatMetric,
  measureValues,
  parseMeasure,
  statusIcon,
  thresholdText,
} from './report.mjs'

/** Marcador del comentario: el bot lo busca para actualizar su comentario en vez de crear otro. */
export const PR_COMMENT_MARKER = '<!-- sonarqube-pr -->'

/** Métricas del código nuevo que se exportan. Los nombres son los de la API de SonarQube. */
export const PR_METRIC_KEYS = [
  'new_reliability_rating',
  'new_security_rating',
  'new_maintainability_rating',
  'new_coverage',
  'new_duplicated_lines_density',
  'new_lines',
  'new_bugs',
  'new_vulnerabilities',
  'new_code_smells',
]

/** Las tres notas del código nuevo, en el orden del comentario. */
const RATINGS = [
  {
    metric: 'new_reliability_rating',
    label: 'Confiabilidad',
    detail: ['bug', 'bugs'],
    count: 'new_bugs',
  },
  {
    metric: 'new_security_rating',
    label: 'Seguridad',
    detail: ['vulnerabilidad', 'vulnerabilidades'],
    count: 'new_vulnerabilities',
  },
  {
    metric: 'new_maintainability_rating',
    label: 'Mantenibilidad',
    detail: ['code smell', 'code smells'],
    count: 'new_code_smells',
  },
]

/** Color de cada nota, como en la interfaz de SonarQube: A verde y E rojo. */
const RATING_EMOJI = { A: '🟢', B: '🟡', C: '🟡', D: '🟠', E: '🔴' }

/** Con menos líneas nuevas que esto, SonarQube no evalúa cobertura ni duplicación en la gate. */
const SMALL_CHANGE_LINES = 20

/**
 * Junta las respuestas de la API del análisis del HEAD en un resumen del código nuevo.
 * @param {object} input
 * @param {{ key: string, name: string }} input.project
 * @param {string} [input.serverVersion]
 * @param {{ name: string, conditions: object[] }} input.gate quality gate del código nuevo
 * @param {object} input.projectStatus respuesta de /api/qualitygates/project_status
 * @param {object} input.measures respuesta de /api/measures/component con PR_METRIC_KEYS
 * @param {object} input.issues respuesta de /api/issues/search con inNewCodePeriod=true
 * @param {string} input.baseSha commit de la base analizada (merge base del PR)
 * @param {string} input.headSha commit del HEAD del PR
 * @param {number} [input.top] cuántos issues se guardan
 */
export function buildPrReport({
  project,
  serverVersion,
  gate,
  projectStatus,
  measures,
  issues,
  baseSha,
  headSha,
  top = 50,
}) {
  const values = measureValues(measures)
  const metrics = Object.fromEntries(
    PR_METRIC_KEYS.map((metric) => [metric, parseMeasure(metric, values[metric])]),
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
  const list = (issues?.issues ?? [])
    .map((issue) => ({
      severity: issue.severity,
      type: issue.type,
      rule: issue.rule,
      message: issue.message,
      file: fileOf(issue.component),
      line: issue.line ?? null,
    }))
    .sort(bySeverity)
  return {
    project,
    serverVersion: serverVersion ?? null,
    baseSha: baseSha ?? null,
    headSha: headSha ?? null,
    qualityGate: {
      name: gate?.name ?? null,
      status: projectStatus?.projectStatus?.status ?? 'NONE',
      conditions,
    },
    metrics,
    issues: {
      total: issues?.total ?? issues?.paging?.total ?? list.length,
      top: list.slice(0, top),
    },
  }
}

const short = (sha) => (sha ? String(sha).slice(0, 7) : '')

function gateText(status) {
  if (status === 'OK') return 'aprobada'
  if (status === 'ERROR') return 'reprobada'
  return 'sin resultado'
}

function ratingCell(letter) {
  return letter ? `${RATING_EMOJI[letter] ?? '⚪'} **${letter}**` : '⚪ sin dato'
}

/** Link al archivo y la línea en el HEAD del PR, o solo el texto si falta el repo o el SHA. */
function whereLink(issue, { serverUrl, repository, headSha }) {
  const text = `${issue.file}${issue.line ? `:${issue.line}` : ''}`
  if (!repository || !headSha) return `\`${text}\``
  const anchor = issue.line ? `#L${issue.line}` : ''
  const path = issue.file.split('/').map(encodeURIComponent).join('/')
  return `[\`${text}\`](${serverUrl}/${repository}/blob/${headSha}/${path}${anchor})`
}

/**
 * Comentario del bot en el PR.
 * @param {ReturnType<typeof buildPrReport>} report
 * @param {object} [links]
 * @param {string} [links.serverUrl] https://github.com
 * @param {string} [links.repository] owner/repo
 * @param {string} [links.runUrl] link al run de Actions
 * @returns {string} markdown
 */
export function renderPrComment(
  report,
  { serverUrl = 'https://github.com', repository, runUrl } = {},
) {
  const gate = report.qualityGate
  const m = report.metrics
  const byMetric = new Map(gate.conditions.map((c) => [c.metric, c]))
  const conditionStatus = (metric) => statusIcon(byMetric.get(metric)?.status ?? 'NONE')
  const conditionThreshold = (metric) => {
    const condition = byMetric.get(metric)
    return condition ? thresholdText(condition) : 'no se evalúa'
  }

  const lines = [
    PR_COMMENT_MARKER,
    '## SonarQube · código nuevo de este PR',
    '',
    `${statusIcon(gate.status)} **Quality gate ${gateText(gate.status)}**` +
      `${gate.name ? ` (\`${gate.name}\`)` : ''}`,
    '',
    'El código nuevo son las líneas que este PR agrega o cambia respecto de la rama base' +
      `${report.baseSha ? ` (\`${short(report.baseSha)}\`)` : ''}. ` +
      `Este PR tiene **${formatMetric('new_lines', m.new_lines ?? 0)} líneas nuevas** de código analizado.`,
    '',
    '| Código nuevo | Valor | Umbral | Estado |',
    '| --- | :---: | --- | :---: |',
  ]
  for (const rating of RATINGS) {
    const count = m[rating.count]
    const detail =
      count === null || count === undefined
        ? ''
        : ` (${count} ${rating.detail[count === 1 ? 0 : 1]})`
    lines.push(
      `| ${rating.label}${detail} | ${ratingCell(m[rating.metric])} | ${conditionThreshold(rating.metric)} | ${conditionStatus(rating.metric)} |`,
    )
  }
  lines.push(
    `| Cobertura de los tests unitarios | ${formatMetric('new_coverage', m.new_coverage)} | ${conditionThreshold('new_coverage')} | ${conditionStatus('new_coverage')} |`,
    `| Líneas duplicadas | ${formatMetric('new_duplicated_lines_density', m.new_duplicated_lines_density)} | ${conditionThreshold('new_duplicated_lines_density')} | ${conditionStatus('new_duplicated_lines_density')} |`,
    '',
    'Las notas van de A (mejor) a E. Confiabilidad mide bugs, seguridad mide vulnerabilidades y ' +
      'mantenibilidad mide code smells (código que funciona pero es difícil de leer o de cambiar).',
  )
  if ((m.new_lines ?? 0) < SMALL_CHANGE_LINES) {
    lines.push(
      `Con menos de ${SMALL_CHANGE_LINES} líneas nuevas, SonarQube no evalúa cobertura ni duplicación en la quality gate.`,
    )
  }
  lines.push('')

  const issues = report.issues
  if (issues.top.length === 0) {
    lines.push(
      '### Defectos nuevos',
      '',
      '✅ Sin defectos nuevos: SonarQube no encontró bugs, vulnerabilidades ni code smells en el código que agrega o cambia este PR.',
      '',
    )
  } else {
    const shown =
      issues.top.length < issues.total
        ? ` (se muestran ${issues.top.length} de ${issues.total})`
        : ''
    lines.push(
      `### Defectos nuevos: ${issues.total}${shown}`,
      '',
      'De mayor a menor severidad. Cada link abre el archivo en el último commit de este PR.',
      '',
      '| Severidad | Tipo | Dónde | Mensaje | Regla |',
      '| --- | --- | --- | --- | --- |',
    )
    for (const issue of issues.top) {
      lines.push(
        `| ${SEVERITY_TEXT[issue.severity] ?? cell(issue.severity)} | ${TYPE_TEXT[issue.type] ?? cell(issue.type)} | ${whereLink(issue, { serverUrl, repository, headSha: report.headSha })} | ${cell(issue.message)} | \`${issue.rule}\` |`,
      )
    }
    lines.push('')
  }

  if (gate.status === 'ERROR') {
    lines.push(
      '❌ El job de SonarQube queda en rojo hasta que el código nuevo cumpla la quality gate. ' +
        'Corrige los defectos de la tabla o agrega tests para el código nuevo y vuelve a subir.',
      '',
    )
  }
  lines.push(
    `<sub>SonarQube Community${report.serverVersion ? ` ${report.serverVersion}` : ''} corrió en un contenedor temporal de este job y se borró al terminar. ` +
      `Analizó la base y después el HEAD${report.headSha ? ` (\`${short(report.headSha)}\`)` : ''} para separar el código nuevo. ` +
      `${runUrl ? `Detalle en el [run de Actions](${runUrl}) y` : 'Detalle'} en el artefacto \`sonarqube\`. ` +
      'Este comentario se actualiza en cada push.</sub>',
    '',
  )
  return lines.join('\n')
}
