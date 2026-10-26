#!/usr/bin/env node
// SonarQube efímero: la etapa 5 del pipeline (job sonarqube) y lo mismo en tu máquina.
//
// 1. Copia los lcov de los tests unitarios a reports/sonarqube/lcov con rutas desde la raíz.
// 2. Levanta SonarQube Community en un contenedor temporal, en una red de Docker propia.
// 3. Lo configura por API: contraseña aleatoria para admin, un token para el scanner y una
//    quality gate propia (QUALITY_GATE, más abajo).
// 4. Analiza el repo con sonar-scanner-cli y sonar-project.properties.
// 5. Exporta quality gate, métricas, issues y hotspots a reports/sonarqube/summary.json y .md.
// 6. Borra el contenedor y la red, pase lo que pase. No queda nada corriendo ni nada que pagar.
//
// Uso, desde la raíz del repo y con la cobertura ya generada:
//   (cd backend && npm run test:unit) && (cd frontend && npm run test:unit)
//   node tools/sonarqube/run.mjs                SonarQube en http://localhost:19000
//   node tools/sonarqube/run.mjs --port 19500   otro puerto si el 19000 está ocupado
//   SONAR_ADMIN_PASSWORD='TuClave#2026' node tools/sonarqube/run.mjs --keep
//                                               no borra el contenedor: entra a la UI con admin
//
// Termina con código 1 si falta la cobertura, si el análisis no pudo correr o si la quality
// gate falla.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { METRIC_KEYS, buildSummary, renderSummaryMarkdown } from './report.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Fijadas por versión y digest, como el resto del pipeline: un tag se puede mover, un digest no.
// SonarQube Community Build es gratis y de código abierto. Tamaño: 1,1 GB y 0,4 GB comprimidas.
export const SONARQUBE_IMAGE =
  'sonarqube:26.10.0.133078-community@sha256:0b3408443fb6a311253de27941b10977c9b977fd53be2265947bfe14161308b8'
export const SCANNER_IMAGE =
  'sonarsource/sonar-scanner-cli:12.3.0.4285_8.1.0@sha256:47956b669bf486bdad919e1cbd0533223515aa0b6d1d31763e5a3754942df6d7'

/**
 * Quality gate propia: las condiciones mínimas que el código debe cumplir para aprobar.
 *
 * Cada corrida crea un proyecto nuevo, así que no existe "código nuevo" con qué comparar
 * (lo que mide la gate por defecto, Sonar way). Por eso las condiciones miran el código
 * completo. Los umbrales sirven para que la calidad no retroceda de un PR a otro:
 *
 * - bugs y vulnerabilidades: 0. Si SonarQube encuentra uno, se corrige antes de integrar.
 * - cobertura: mínimo 80 %. Hoy es cerca de 86 % en las mismas carpetas que miden Jest y
 *   Vitest (ver sonar.coverage.exclusions). SonarQube junta líneas y ramas, por eso es algo
 *   menor que el porcentaje de líneas que muestra Jest.
 * - líneas duplicadas: máximo 3 %. Copiar y pegar obliga a corregir el mismo error dos veces.
 * - nota de mantenibilidad: A. La nota baja si arreglar los code smells tomaría más del 5 %
 *   del tiempo que costó escribir el código.
 *
 * op GT: falla si el valor es mayor que error. op LT: falla si el valor es menor.
 */
export const QUALITY_GATE = {
  name: 'Biblioteca UC',
  conditions: [
    { metric: 'bugs', op: 'GT', error: '0' },
    { metric: 'vulnerabilities', op: 'GT', error: '0' },
    { metric: 'coverage', op: 'LT', error: '80' },
    { metric: 'duplicated_lines_density', op: 'GT', error: '3' },
    { metric: 'sqale_rating', op: 'GT', error: '1' },
  ],
}

/** Apps con tests unitarios: carpeta y lcov que deja npm run test:unit. */
export const COVERAGE = [
  { app: 'backend', lcov: 'backend/reports/coverage/lcov.info' },
  { app: 'frontend', lcov: 'frontend/reports/coverage/lcov.info' },
]

// ---------------------------------------------------------------------------
// Preparación
// ---------------------------------------------------------------------------

/** Lee un archivo .properties simple (clave=valor, # para comentarios). */
export function readProperties(text) {
  const properties = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index > 0) properties[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim()
  }
  return properties
}

/**
 * Jest y Vitest escriben las rutas del lcov desde la carpeta de cada app (SF:src/a.ts).
 * SonarQube analiza desde la raíz del repo y necesita SF:backend/src/a.ts.
 * Las rutas absolutas se dejan relativas a la raíz.
 */
export function rewriteLcov(content, app, repoRoot) {
  return content.replace(/^SF:(.+)$/gm, (_, file) => {
    const path = file.trim()
    const fromRoot = isAbsolute(path) ? relative(repoRoot, path) : join(app, path)
    return `SF:${fromRoot.split('\\').join('/')}`
  })
}

function prepareCoverage(repoRoot, outDir) {
  const missing = COVERAGE.filter(({ lcov }) => !existsSync(join(repoRoot, lcov)))
  if (missing.length > 0) {
    const commands = missing.map(({ app }) => `(cd ${app} && npm run test:unit)`).join(' && ')
    throw new Error(
      `Falta la cobertura de ${missing.map((m) => m.app).join(' y ')}. Genérala primero con: ${commands}`,
    )
  }
  mkdirSync(outDir, { recursive: true })
  for (const { app, lcov } of COVERAGE) {
    const content = readFileSync(join(repoRoot, lcov), 'utf8')
    writeFileSync(join(outDir, `${app}.info`), rewriteLcov(content, app, repoRoot))
  }
}

/** Cumple la política de SonarQube: 12 o más caracteres, mayúscula, minúscula, número y símbolo. */
function generatePassword() {
  return `${randomBytes(24).toString('hex')}Aa#`
}

/** En GitHub Actions oculta el valor en todos los logs del job. */
function mask(value) {
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${value}`)
}

// ---------------------------------------------------------------------------
// Docker y API de SonarQube
// ---------------------------------------------------------------------------

function docker(args, options = {}) {
  const run = spawnSync('docker', args, { encoding: 'utf8', ...options })
  if (run.error) throw new Error(`No se pudo ejecutar docker: ${run.error.message}`)
  return run
}

function dockerOrFail(args) {
  const run = docker(args)
  if (run.status !== 0) throw new Error(`docker ${args[0]} falló: ${run.stderr.trim()}`)
  return run.stdout.trim()
}

function basicAuth(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
}

/** Llama a la Web API. Los POST van como formulario, que es lo que espera SonarQube. */
async function api(baseUrl, path, { method = 'GET', params = {}, auth } = {}) {
  const query = new URLSearchParams(params).toString()
  const url = method === 'GET' && query ? `${baseUrl}${path}?${query}` : `${baseUrl}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? query : undefined,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path} respondió ${response.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function waitUntilUp(baseUrl, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs
  let last = 'sin respuesta'
  while (Date.now() < deadline) {
    try {
      const status = await api(baseUrl, '/api/system/status')
      if (status?.status === 'UP') return status
      last = status?.status ?? last
    } catch {
      // Todavía no acepta conexiones: Elasticsearch y la base interna están partiendo
    }
    await sleep(3000)
  }
  throw new Error(`SonarQube no quedó UP en ${timeoutMs / 1000} s (último estado: ${last})`)
}

/** Contraseña nueva para admin, token del scanner y quality gate propia por defecto. */
async function configure(baseUrl, password) {
  await api(baseUrl, '/api/users/change_password', {
    method: 'POST',
    auth: basicAuth('admin', 'admin'),
    params: { login: 'admin', previousPassword: 'admin', password },
  })
  const auth = basicAuth('admin', password)
  const { token } = await api(baseUrl, '/api/user_tokens/generate', {
    method: 'POST',
    auth,
    params: { name: 'ci', type: 'GLOBAL_ANALYSIS_TOKEN' },
  })
  mask(token)
  // Modo estándar: bugs, vulnerabilidades y code smells, los términos que usa la clase.
  // Si esta versión no tiene el ajuste, se sigue igual: esas métricas existen en ambos modos
  try {
    await api(baseUrl, '/api/settings/set', {
      method: 'POST',
      auth,
      params: { key: 'sonar.multi-quality-mode.enabled', value: 'false' },
    })
  } catch (error) {
    console.log(`Aviso: no se pudo activar el modo estándar (${error.message}).`)
  }
  await api(baseUrl, '/api/qualitygates/create', {
    method: 'POST',
    auth,
    params: { name: QUALITY_GATE.name },
  })
  for (const condition of QUALITY_GATE.conditions) {
    await api(baseUrl, '/api/qualitygates/create_condition', {
      method: 'POST',
      auth,
      params: { gateName: QUALITY_GATE.name, ...condition },
    })
  }
  await api(baseUrl, '/api/qualitygates/set_as_default', {
    method: 'POST',
    auth,
    params: { name: QUALITY_GATE.name },
  })
  return { auth, token }
}

/** Corre el scanner en otro contenedor de la misma red. El token viaja por variable de entorno. */
function runScanner({ network, hostUrl, token }) {
  const user = process.getuid ? ['--user', `${process.getuid()}:${process.getgid()}`] : []
  const run = docker(
    [
      'run',
      '--rm',
      '--network',
      network,
      ...user,
      '-e',
      'SONAR_TOKEN',
      '-e',
      `SONAR_HOST_URL=${hostUrl}`,
      '-e',
      'SONAR_USER_HOME=/tmp/sonar-home',
      '-e',
      'HOME=/tmp',
      '-v',
      `${ROOT}:/usr/src`,
      '-w',
      '/usr/src',
      SCANNER_IMAGE,
      'sonar-scanner',
      // Archivos de trabajo del scanner dentro del contenedor: no ensucian el repo
      '-Dsonar.working.directory=/tmp/scannerwork',
    ],
    { stdio: 'inherit', env: { ...process.env, SONAR_TOKEN: token } },
  )
  return run.status ?? 1
}

async function exportSummary(baseUrl, auth, project, serverVersion) {
  const get = (path, params) => api(baseUrl, path, { auth, params })
  const [projectStatus, measures, issues, hotspots] = await Promise.all([
    get('/api/qualitygates/project_status', { projectKey: project.key }),
    get('/api/measures/component', { component: project.key, metricKeys: METRIC_KEYS.join(',') }),
    get('/api/issues/search', { components: project.key, resolved: 'false', ps: '100' }),
    get('/api/hotspots/search', { project: project.key, status: 'TO_REVIEW', ps: '100' }),
  ])
  return buildSummary({
    project,
    serverVersion,
    gate: QUALITY_GATE,
    projectStatus,
    measures,
    issues,
    hotspots,
  })
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {}
  const queue = [...argv]
  while (queue.length > 0) {
    const key = queue.shift().replace(/^--/, '')
    args[key] = queue[0] && !queue[0].startsWith('--') ? queue.shift() : true
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const port = Number(args.port ?? 19000)
  const keep = Boolean(args.keep)
  const outDir = join(ROOT, 'reports', 'sonarqube')
  const properties = readProperties(readFileSync(join(ROOT, 'sonar-project.properties'), 'utf8'))
  const project = { key: properties['sonar.projectKey'], name: properties['sonar.projectName'] }

  prepareCoverage(ROOT, join(outDir, 'lcov'))

  const id = `${process.pid}`
  const container = `sonarqube-efimero-${id}`
  const network = `sonarqube-efimero-${id}`
  const cleanup = () => {
    docker(['rm', '-f', container])
    docker(['network', 'rm', network])
  }
  process.once('SIGINT', () => {
    cleanup()
    process.exit(130)
  })

  let ok = false
  try {
    console.log(`Levantando ${SONARQUBE_IMAGE.split('@')[0]} en el puerto ${port}...`)
    dockerOrFail(['network', 'create', network])
    dockerOrFail([
      'run',
      '--detach',
      '--name',
      container,
      '--network',
      network,
      // Solo en localhost: nadie fuera de esta máquina llega a SonarQube
      '--publish',
      `127.0.0.1:${port}:9000`,
      // Elasticsearch exige vm.max_map_count alto para producción. Aquí no hace falta
      '-e',
      'SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true',
      '-e',
      'SONAR_TELEMETRY_ENABLE=false',
      SONARQUBE_IMAGE,
    ])
    const baseUrl = `http://127.0.0.1:${port}`
    let status
    try {
      status = await waitUntilUp(baseUrl)
    } catch (error) {
      console.log(docker(['logs', '--tail', '80', container]).stdout)
      throw error
    }
    console.log(`SonarQube ${status.version} listo. Configurando contraseña, token y quality gate.`)

    const password = process.env.SONAR_ADMIN_PASSWORD || generatePassword()
    mask(password)
    const { auth, token } = await configure(baseUrl, password)

    console.log('Analizando el repo con sonar-scanner-cli y sonar-project.properties...')
    const scanStatus = runScanner({ network, hostUrl: `http://${container}:9000`, token })

    const summary = await exportSummary(baseUrl, auth, project, status.version)
    const markdown = `${renderSummaryMarkdown(summary).join('\n')}\n`
    writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
    writeFileSync(join(outDir, 'summary.md'), markdown)
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)

    const gate = summary.qualityGate
    for (const condition of gate.conditions) {
      console.log(
        `  ${condition.status === 'OK' ? 'ok   ' : 'FALLA'} ${condition.label}: ${condition.actual} (${condition.comparator} ${condition.threshold})`,
      )
    }
    console.log(`Quality gate: ${gate.status}. Resumen en ${relative(ROOT, outDir)}/summary.md`)
    ok = scanStatus === 0 && gate.status === 'OK'
    if (!ok) {
      console.log(
        `::error title=SonarQube::La quality gate no aprobó (estado ${gate.status}, scanner ${scanStatus}).`,
      )
    }
  } finally {
    if (keep) {
      console.log(
        `SonarQube sigue en http://localhost:${port}. Entra con admin y la contraseña de SONAR_ADMIN_PASSWORD` +
          ' (si no la definiste, se generó una al azar y no se muestra).',
      )
      console.log(`Para borrarlo: docker rm -f ${container} && docker network rm ${network}`)
    } else {
      cleanup()
    }
  }
  process.exitCode = ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`::error title=SonarQube::${error.message}`)
    process.exitCode = 1
  })
}
