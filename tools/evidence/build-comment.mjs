#!/usr/bin/env node
// Construye el comentario de evidencia del PR (etapa 10 del pipeline).
//
// Junta los artefactos que dejaron las otras etapas y los resume en un solo
// comentario en español: estado de cada etapa DevSecOps, GIF y capturas de los
// flujos de usuario, endpoints verificados en el backend y hallazgos de seguridad.
// Todo es opcional: si falta un artefacto, su sección dice "no disponible".
//
// Uso:
//   node tools/evidence/build-comment.mjs --artifacts <carpeta> --out comment.md
//
// Variables de entorno (las entrega el workflow):
//   NEEDS_JSON          resultado de cada job: ${{ toJSON(needs) }}
//   EVIDENCE_BASE_URL   URL raw de la rama "evidence" para este run
//   RUN_URL             URL del run de Actions
//   PR_NUMBER, HEAD_SHA
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse as parseYaml } from 'yaml'

export const MARKER = '<!-- ci-evidence -->'

/** Etapas del pipeline y los jobs de ci.yml que pertenecen a cada una. */
export const STAGES = [
  { n: 1, name: 'Pre-commit y secretos', what: 'gitleaks', jobs: ['secretos'] },
  {
    n: 2,
    name: 'Calidad y especificación',
    what: 'lint, tipos, arquitectura, Spectral, oasdiff, spec-trace, hadolint, actionlint, zizmor',
    jobs: ['calidad-backend', 'calidad-frontend', 'contrato-openapi', 'trazabilidad', 'lint-infra'],
  },
  { n: 3, name: 'SAST', what: 'Semgrep y CodeQL', jobs: ['semgrep', 'codeql'] },
  {
    n: 4,
    name: 'Dependencias (SCA)',
    what: 'dependency review, npm audit, Trivy fs',
    jobs: ['dependencias', 'trivy-fs'],
  },
  {
    n: 5,
    name: 'Tests unitarios',
    what: 'dominio y aplicación sin mocks, componentes con MSW',
    jobs: ['unit-backend', 'unit-frontend'],
  },
  {
    n: 6,
    name: 'Integración y contrato backend',
    what: 'Testcontainers (PostgreSQL) y supertest contra el OpenAPI',
    jobs: ['integracion-backend'],
  },
  {
    n: 7,
    name: 'E2E frontend con mock server',
    what: 'Playwright + MSW: flujos, visual, estilos, layout y a11y',
    jobs: ['e2e-frontend'],
  },
  { n: 8, name: 'Build e imágenes', what: 'docker build, Trivy image, SBOM', jobs: ['imagenes'] },
  {
    n: 9,
    name: 'Sistema y DAST',
    what: 'smoke API, Schemathesis, Playwright @smoke, k6, Lighthouse, OWASP ZAP',
    jobs: ['sistema', 'dast'],
  },
]

const RESULT_ICON = { success: '✅', failure: '❌', cancelled: '🚫', skipped: '⏭️' }
const RESULT_TEXT = {
  success: 'ok',
  failure: 'falló',
  cancelled: 'cancelado',
  skipped: 'omitido (sin cambios)',
}

// ---------------------------------------------------------------------------
// Lectura de artefactos
// ---------------------------------------------------------------------------

function listFiles(dir) {
  if (!dir || !existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Busca el primer archivo con ese nombre (o que cumpla el patrón) dentro de los artefactos. */
function findFile(files, matcher) {
  return files.find((file) =>
    typeof matcher === 'string' ? file.endsWith(`${sep}${matcher}`) : matcher.test(file),
  )
}

export function loadArtifacts(dir) {
  const files = listFiles(dir)
  const json = (name) => {
    const file = findFile(files, name)
    return file ? readJson(file) : null
  }

  // Manifiestos de evidencia del frontend: se distinguen por el campo target
  const manifests = {}
  for (const file of files.filter((f) => f.endsWith(`${sep}manifest.json`))) {
    const data = readJson(file)
    if (!data || !Array.isArray(data.items)) continue
    const target = data.target ?? (file.includes('fullstack') ? 'fullstack' : 'mock')
    manifests[target] = { ...data, dir: dirname(file), relDir: relative(dir, dirname(file)) }
  }

  // Lighthouse CI: manifest.json (arreglo) o lhr-*.json
  let lighthouse = null
  const lhciManifest = files
    .filter((f) => f.endsWith(`${sep}manifest.json`))
    .map(readJson)
    .find((data) => Array.isArray(data) && data[0]?.summary)
  if (lhciManifest) {
    const run = lhciManifest.find((r) => r.isRepresentativeRun) ?? lhciManifest[0]
    lighthouse = { url: run.url, scores: run.summary }
  } else {
    const lhr = findFile(files, /lhr-[^/\\]*\.json$/)
    const data = lhr ? readJson(lhr) : null
    if (data?.categories) {
      lighthouse = {
        url: data.finalDisplayedUrl ?? data.requestedUrl,
        scores: Object.fromEntries(Object.entries(data.categories).map(([k, v]) => [k, v.score])),
      }
    }
  }
  const links = json('links.json')
  if (lighthouse && links) lighthouse.report = Object.values(links)[0]

  const junitFile = findFile(files, /schemathesis[^]*\.xml$/) ?? findFile(files, 'junit.xml')

  return {
    files,
    manifests,
    contract: json('contract-coverage.json'),
    smoke: json('endpoints.json'),
    schemathesis: junitFile ? parseJunit(readFileSync(junitFile, 'utf8')) : null,
    semgrep: json('semgrep.json'),
    trivy: {
      fs: json('trivy-fs.json'),
      backend: json('trivy-image-backend.json'),
      frontend: json('trivy-image-frontend.json'),
    },
    zap: { frontend: json('zap-frontend.json'), api: json('zap-api.json') },
    gitleaks: json('gitleaks.json'),
    lighthouse,
    k6: json('k6-summary.json'),
    specTrace: json('spec-trace.json'),
  }
}

/** Lee un reporte JUnit (Schemathesis) sin dependencias: casos y fallas. */
export function parseJunit(xml) {
  const cases = []
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g
  for (const match of xml.matchAll(re)) {
    const name = match[1].match(/name="([^"]*)"/)?.[1] ?? '?'
    const body = match[3] ?? ''
    const failed = /<(failure|error)\b/.test(body)
    const message = body.match(/<(?:failure|error)\b[^>]*message="([^"]*)"/)?.[1] ?? ''
    cases.push({ name: decodeXml(name), failed, message: decodeXml(message) })
  }
  return { total: cases.length, failed: cases.filter((c) => c.failed).length, cases }
}

const decodeXml = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** Operaciones del contrato (method, path, operationId) leídas desde el OpenAPI. */
export function loadOperations(openapiPath) {
  try {
    const spec = parseYaml(readFileSync(openapiPath, 'utf8'))
    const operations = []
    for (const [path, item] of Object.entries(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(item)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
        operations.push({
          method: method.toUpperCase(),
          path,
          operationId: op.operationId,
          summary: op.summary,
        })
      }
    }
    return operations
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Resúmenes por herramienta
// ---------------------------------------------------------------------------

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export function summarizeTrivy(report) {
  if (!report) return null
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]))
  let secrets = 0
  let misconfigs = 0
  for (const result of report.Results ?? []) {
    for (const vuln of result.Vulnerabilities ?? []) {
      if (vuln.Severity in counts) counts[vuln.Severity] += 1
    }
    secrets += (result.Secrets ?? []).length
    misconfigs += (result.Misconfigurations ?? []).filter((m) => m.Status === 'FAIL').length
  }
  return { counts, secrets, misconfigs }
}

const SEMGREP_LEVEL = {
  CRITICAL: 'ERROR',
  HIGH: 'ERROR',
  ERROR: 'ERROR',
  MEDIUM: 'WARNING',
  WARNING: 'WARNING',
  LOW: 'INFO',
  INFO: 'INFO',
}

export function summarizeSemgrep(report) {
  if (!report) return null
  const counts = { ERROR: 0, WARNING: 0, INFO: 0 }
  const findings = (report.results ?? []).map((r) => {
    const level = SEMGREP_LEVEL[r.extra?.severity] ?? 'INFO'
    counts[level] += 1
    return { rule: r.check_id, path: r.path, line: r.start?.line, level, message: r.extra?.message }
  })
  return { counts, findings }
}

const ZAP_RISK = { 3: 'High', 2: 'Medium', 1: 'Low', 0: 'Informational' }

export function summarizeZap(report) {
  if (!report) return null
  const counts = { High: 0, Medium: 0, Low: 0, Informational: 0 }
  const alerts = []
  for (const site of report.site ?? []) {
    for (const alert of site.alerts ?? []) {
      const risk = ZAP_RISK[Number(alert.riskcode)] ?? 'Informational'
      counts[risk] += 1
      alerts.push({ risk, name: alert.name ?? alert.alert, count: Number(alert.count ?? 1) })
    }
  }
  return { counts, alerts }
}

// ---------------------------------------------------------------------------
// Secciones del comentario
// ---------------------------------------------------------------------------

function stageResult(stage, needs) {
  const results = stage.jobs.map((job) => needs[job]?.result).filter(Boolean)
  if (results.length === 0) return 'skipped'
  if (results.includes('failure')) return 'failure'
  if (results.includes('cancelled')) return 'cancelled'
  if (results.every((r) => r === 'skipped')) return 'skipped'
  return 'success'
}

function stagesSection(needs) {
  const lines = [
    '### 🚦 Etapas DevSecOps',
    '',
    '| Etapa | Qué verifica | Jobs | Estado |',
    '| --- | --- | --- | :---: |',
  ]
  for (const stage of STAGES) {
    const jobs = stage.jobs
      .map((job) => `${RESULT_ICON[needs[job]?.result] ?? '⏭️'} \`${job}\``)
      .join(' ')
    const result = stageResult(stage, needs)
    lines.push(
      `| **${stage.n} · ${stage.name}** | ${stage.what} | ${jobs} | ${RESULT_ICON[result]} |`,
    )
  }
  return lines
}

const encodePath = (path) => path.split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/')

function mediaUrl(base, manifest, path) {
  return `${base}/${encodePath(join(manifest.relDir, path))}`
}

function frontendTarget(title, manifest, ctx) {
  const lines = [`#### ${title}`, '']
  if (!manifest) {
    lines.push('_No disponible: la etapa no corrió o no dejó evidencia._', '')
    return lines
  }
  const passed = manifest.items.filter((item) => item.status === 'passed').length
  lines.push(`${passed} de ${manifest.items.length} escenarios pasaron.`, '')
  manifest.items.forEach((item, index) => {
    const icon = item.status === 'passed' ? '✅' : item.status === 'skipped' ? '⏭️' : '❌'
    lines.push(`<details${index < ctx.openItems ? ' open' : ''}>`)
    lines.push(`<summary>${icon} <b>${item.id}</b> · ${item.title}</summary>`, '')
    if (item.video) {
      const gif = item.video.replace(/\.webm$/, '.gif')
      const gifExists = ctx.example || existsSync(join(manifest.dir, gif))
      if (gifExists && ctx.baseUrl) {
        lines.push(
          `<img src="${mediaUrl(ctx.baseUrl, manifest, gif)}" width="560" alt="Video de ${item.id}">`,
          '',
        )
      } else {
        lines.push(`🎬 Video disponible en los [artefactos del run](${ctx.runUrl}#artifacts).`, '')
      }
    }
    const shots = item.screenshots ?? []
    if (shots.length > 0 && ctx.baseUrl) {
      const thumbs = shots.map((shot) => {
        const url = mediaUrl(ctx.baseUrl, manifest, shot)
        const name = shot.split('/').pop()
        return `<a href="${url}"><img src="${url}" width="180" alt="${name}" title="${name}"></a>`
      })
      lines.push(thumbs.join(' '), '')
    }
    lines.push('</details>', '')
  })
  return lines
}

function frontendSection(artifacts, ctx) {
  return [
    '### 🖥️ Frontend: flujos de usuario',
    '',
    'Cada escenario de `specs/flows/*.feature` es un test de Playwright (playwright-bdd). El GIF es el video real de la prueba.',
    '',
    ...frontendTarget('Contra el mock server (MSW, sin backend)', artifacts.manifests.mock, ctx),
    ...frontendTarget(
      'Contra el stack real (docker compose con PostgreSQL)',
      artifacts.manifests.fullstack,
      {
        ...ctx,
        openItems: 1,
      },
    ),
  ]
}

function backendSection(artifacts, operations) {
  const lines = ['### ⚙️ Backend: endpoints verificados', '']
  const contractOps = artifacts.contract?.operations ?? []
  const smokeResults = artifacts.smoke?.results ?? []
  const known = operations.length > 0 ? operations : unionOperations(contractOps, smokeResults)

  if (contractOps.length === 0 && smokeResults.length === 0) {
    lines.push('_No disponible: no hay reporte de contrato ni smoke._', '')
  } else {
    lines.push(
      '| Operación | Método y ruta | Contrato (supertest + Testcontainers) | Smoke contra el stack real |',
      '| --- | --- | --- | --- |',
    )
    for (const op of known) {
      const contract = contractOps.find((c) => c.operationId === op.operationId)
      const contractCell = contract
        ? `${contract.passed ? '✅' : '❌'} ${contract.statuses.join(' · ')}`
        : artifacts.contract
          ? '⚠️ sin test de contrato'
          : 'no disponible'
      const smoke = smokeResults.filter((r) => r.operationId === op.operationId)
      const smokeCell =
        smoke.length > 0
          ? `${smoke.every((r) => r.ok) ? '✅' : '❌'} ${smoke.map((r) => r.actual ?? '---').join(' · ')} (máx. ${Math.max(...smoke.map((r) => r.ms ?? 0))} ms)`
          : artifacts.smoke
            ? '⚠️ sin verificación'
            : 'no disponible'
      lines.push(
        `| \`${op.operationId}\` | \`${op.method} ${op.path}\` | ${contractCell} | ${smokeCell} |`,
      )
    }
    lines.push('')
    if (artifacts.smoke) {
      lines.push(
        `Smoke: ${artifacts.smoke.passed} de ${artifacts.smoke.total} verificaciones OK en ${artifacts.smoke.durationMs} ms.`,
        '',
      )
    }
  }

  const st = artifacts.schemathesis
  lines.push('#### 🧬 Schemathesis (property based testing desde el OpenAPI)', '')
  if (!st) {
    lines.push('_No disponible._', '')
  } else {
    lines.push(
      `${st.failed === 0 ? '✅' : '❌'} ${st.total - st.failed} de ${st.total} operaciones sin violaciones del contrato.`,
      '',
    )
    for (const c of st.cases.filter((x) => x.failed)) lines.push(`- ❌ \`${c.name}\` ${c.message}`)
    if (st.failed > 0) lines.push('')
  }
  return lines
}

function unionOperations(contractOps, smokeResults) {
  const map = new Map()
  for (const op of [...contractOps, ...smokeResults]) {
    if (!map.has(op.operationId))
      map.set(op.operationId, { method: op.method, path: op.path, operationId: op.operationId })
  }
  return [...map.values()]
}

const fmtCounts = (counts) =>
  Object.entries(counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')

function trivyCell(summary) {
  if (!summary) return 'no disponible'
  const icon =
    summary.counts.CRITICAL > 0 || summary.secrets > 0
      ? '❌'
      : summary.counts.HIGH > 0
        ? '⚠️'
        : '✅'
  const extra = []
  if (summary.secrets > 0) extra.push(`secretos ${summary.secrets}`)
  if (summary.misconfigs > 0) extra.push(`misconfig ${summary.misconfigs}`)
  return `${icon} ${fmtCounts(summary.counts)}${extra.length ? ` · ${extra.join(' · ')}` : ''}`
}

function zapCell(summary) {
  if (!summary) return 'no disponible'
  const icon = summary.counts.High > 0 ? '❌' : summary.counts.Medium > 0 ? '⚠️' : '✅'
  return `${icon} ${fmtCounts(summary.counts)}`
}

function securitySection(artifacts, needs) {
  const semgrep = summarizeSemgrep(artifacts.semgrep)
  const zapFront = summarizeZap(artifacts.zap.frontend)
  const zapApi = summarizeZap(artifacts.zap.api)
  const gitleaks = artifacts.gitleaks
  const jobCell = (job) =>
    `${RESULT_ICON[needs[job]?.result] ?? '⏭️'} ${RESULT_TEXT[needs[job]?.result] ?? 'no corrió'}`

  const rows = [
    [
      'gitleaks',
      'Secretos',
      Array.isArray(gitleaks)
        ? `${gitleaks.length === 0 ? '✅' : '❌'} ${gitleaks.length} hallazgos`
        : 'no disponible',
    ],
    [
      'Semgrep',
      'SAST',
      semgrep
        ? `${semgrep.counts.ERROR > 0 ? '❌' : semgrep.counts.WARNING > 0 ? '⚠️' : '✅'} ${fmtCounts(semgrep.counts)}`
        : 'no disponible',
    ],
    ['CodeQL', 'SAST', `${jobCell('codeql')} (detalle en la pestaña Security)`],
    ['Dependency review y npm audit', 'SCA', jobCell('dependencias')],
    ['Trivy fs', 'SCA, secretos e IaC', trivyCell(summarizeTrivy(artifacts.trivy.fs))],
    ['Trivy imagen backend', 'Contenedor', trivyCell(summarizeTrivy(artifacts.trivy.backend))],
    ['Trivy imagen frontend', 'Contenedor', trivyCell(summarizeTrivy(artifacts.trivy.frontend))],
    ['OWASP ZAP baseline (frontend)', 'DAST', zapCell(zapFront)],
    ['OWASP ZAP API scan (backend)', 'DAST', zapCell(zapApi)],
  ]
  const lh = artifacts.lighthouse
  if (lh) {
    const names = {
      performance: 'Rendimiento',
      accessibility: 'Accesibilidad',
      'best-practices': 'Buenas prácticas',
      seo: 'SEO',
    }
    const scores = Object.entries(lh.scores)
      .filter(([k]) => names[k])
      .map(([k, v]) => `${names[k]} ${Math.round(v * 100)}`)
    const min = Math.min(...Object.values(lh.scores).map((v) => v * 100))
    rows.push([
      'Lighthouse CI',
      'Calidad web',
      `${min >= 90 ? '✅' : '⚠️'} ${scores.join(' · ')}${lh.report ? ` · [reporte](${lh.report})` : ''}`,
    ])
  } else {
    rows.push(['Lighthouse CI', 'Calidad web', 'no disponible'])
  }
  const k6 = artifacts.k6
  rows.push([
    'k6',
    'Rendimiento API',
    k6
      ? `${k6.ok ? '✅' : '❌'} p95 ${k6.p95} ms · errores ${(k6.failedRate * 100).toFixed(2)} % · ${k6.requests} solicitudes`
      : 'no disponible',
  ])
  const trace = artifacts.specTrace?.summary
  rows.push([
    'spec-trace',
    'Trazabilidad SDD',
    trace
      ? `${trace.ok ? '✅' : '❌'} ${trace.coveredRules} de ${trace.requiredRules} reglas con tests · ${trace.orphans} huérfanos · ${trace.overBudget} sobre presupuesto`
      : 'no disponible',
  ])

  const lines = [
    '### 🔐 Seguridad y calidad',
    '',
    '| Herramienta | Tipo | Resultado |',
    '| --- | --- | --- |',
  ]
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`)
  lines.push('')

  const details = []
  if (semgrep?.findings.length) {
    details.push('<details><summary>Hallazgos de Semgrep</summary>', '')
    for (const f of semgrep.findings.slice(0, 10)) {
      details.push(`- **${f.level}** \`${f.rule}\` en \`${f.path}:${f.line}\``)
    }
    details.push('', '</details>', '')
  }
  const zapAlerts = [...(zapFront?.alerts ?? []), ...(zapApi?.alerts ?? [])].filter(
    (a) => a.risk !== 'Informational',
  )
  if (zapAlerts.length) {
    details.push('<details><summary>Alertas de ZAP (sin las informativas)</summary>', '')
    for (const a of zapAlerts.slice(0, 15)) details.push(`- **${a.risk}** ${a.name} (${a.count})`)
    details.push('', '</details>', '')
  }
  return [...lines, ...details]
}

// ---------------------------------------------------------------------------
// Comentario completo
// ---------------------------------------------------------------------------

export function buildComment({
  artifacts,
  needs,
  operations,
  baseUrl,
  runUrl,
  prNumber,
  sha,
  example = false,
}) {
  const results = Object.values(needs).map((job) => job.result)
  const failed = results.includes('failure')
  const cancelled = results.includes('cancelled')
  const status = failed
    ? '❌ Hay etapas con fallas'
    : cancelled
      ? '🚫 Run cancelado'
      : '✅ Todo en verde'
  const shortSha = (sha ?? '').slice(0, 7)

  const lines = [
    MARKER,
    `## 🧪 Evidencia de CI${prNumber ? ` · PR #${prNumber}` : ''}`,
    '',
    `**${status}**${shortSha ? ` · commit \`${shortSha}\`` : ''}${runUrl ? ` · [ver el run](${runUrl}) · [artefactos](${runUrl}#artifacts)` : ''}`,
    '',
    ...stagesSection(needs),
    '',
    ...frontendSection(artifacts, { baseUrl, runUrl, example, openItems: 3 }),
    ...backendSection(artifacts, operations),
    ...securitySection(artifacts, needs),
    '---',
    '_Generado por la etapa 10 de `.github/workflows/ci.yml`. Este comentario se actualiza en cada push del PR. ' +
      'Las imágenes viven en la rama `evidence`._',
  ]
  return `${lines.join('\n')}\n`
}

function parseArgs(argv) {
  const args = {}
  const queue = [...argv]
  while (queue.length > 0) {
    const key = queue.shift().replace(/^--/, '')
    args[key] = queue[0] && !queue[0].startsWith('--') ? queue.shift() : true
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const artifactsDir = resolve(args.artifacts ?? 'artifacts')
  const out = resolve(args.out ?? 'comment.md')
  const example = Boolean(args.example)

  let needsJson = process.env.NEEDS_JSON
  if (!needsJson && example) needsJson = readFileSync(join(artifactsDir, 'needs.json'), 'utf8')
  const needs = needsJson ? JSON.parse(needsJson) : {}

  const ctx = example
    ? {
        prNumber: '42',
        sha: '3f2a9c1d7e5b',
        runUrl:
          'https://github.com/UC-IIC-3143-Software-Development/full_stack_testing/actions/runs/1234567890',
        baseUrl:
          'https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890',
      }
    : {
        prNumber: process.env.PR_NUMBER,
        sha: process.env.HEAD_SHA,
        runUrl: process.env.RUN_URL,
        baseUrl: process.env.EVIDENCE_BASE_URL,
      }

  const comment = buildComment({
    artifacts: loadArtifacts(artifactsDir),
    needs,
    operations: loadOperations(resolve(root, process.env.OPENAPI_PATH ?? 'specs/api/openapi.yaml')),
    example,
    ...ctx,
  })
  writeFileSync(out, comment)
  console.log(`Comentario escrito en ${out} (${comment.length} caracteres)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
