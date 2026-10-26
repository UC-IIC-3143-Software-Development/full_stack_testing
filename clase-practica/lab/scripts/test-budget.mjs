// Baranda determinista contra suites infladas (típicas de generación con IA).
// Lee el reporte JSON de Vitest y los archivos de test, y falla si detecta:
//   - pirámide invertida (cono de helado) según maxRatioToUnit
//   - tests duplicados o casi duplicados (cupcake dentro de la misma capa)
//   - aserciones débiles que no detectan regresiones
//   - patrones típicamente flaky (tiempos, sleeps)
// Además sugiere tests de capas altas que probablemente pertenecen a unit.
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

const config = JSON.parse(readFileSync('test-budget.config.json', 'utf8'))
const report = JSON.parse(readFileSync('reports/vitest.json', 'utf8'))

const layerOf = (file) =>
  Object.entries(config.layers).find(([, pattern]) => new RegExp(pattern).test(file))?.[0] ??
  'sin-capa'

const tests = report.testResults.flatMap((suite) =>
  suite.assertionResults.map((t) => ({
    file: relative(process.cwd(), suite.name),
    layer: layerOf(suite.name),
    name: [...t.ancestorTitles, t.title].join(' > '),
    title: t.title,
    duration: t.duration ?? 0,
  })),
)

const problems = {}
const report_ = (kind, message) => (problems[kind] ??= []).push(message)

// 1. Forma de la pirámide
const count = {}
for (const t of tests) count[t.layer] = (count[t.layer] ?? 0) + 1
const unit = count.unit ?? 0
for (const [layer, maxRatio] of Object.entries(config.maxRatioToUnit)) {
  const n = count[layer] ?? 0
  if (n > Math.floor(unit * maxRatio)) {
    report_(
      'pyramid',
      `${layer}: ${n} tests, máximo ${Math.floor(unit * maxRatio)} (${maxRatio} × ${unit} unit)`,
    )
  }
}

// 2. Duplicados: títulos iguales al quitar números, identificadores y relleno
const FILLER =
  /\b(should|it|a|an|the|another|yet|other|again|also|correctly|with|for|of|to|is|be|deberia|debe|otro|otra|un|una|el|la)\b/g
const normalize = (title) =>
  title
    .toLowerCase()
    .replace(/[\w-]*\d[\w-]*/g, '') // SKU-2, 999999, 200ms, %d
    .replace(/[^a-záéíóúñ ]/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const groups = new Map()
for (const t of tests) {
  const key = `${t.layer}|${t.name.split(' > ').slice(0, -1).join(' > ')}|${normalize(t.title)}`
  groups.set(key, [...(groups.get(key) ?? []), t])
}
for (const group of groups.values()) {
  if (group.length > 1) {
    report_(
      'duplicates',
      `${group.length} casi iguales en ${group[0].file}:\n      - ${group.map((t) => t.title).join('\n      - ')}`,
    )
  }
}

// 3 y 4. Aserciones débiles y patrones flaky (análisis estático de los archivos)
const files = [...new Set(tests.map((t) => t.file))]
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (config.weakAssertions.some((p) => new RegExp(p).test(line))) {
        report_('weakAssertions', `${file}:${i + 1}  ${line.trim()}`)
      }
      if (config.flakyPatterns.some((p) => new RegExp(p).test(line))) {
        report_('flaky', `${file}:${i + 1}  ${line.trim()}`)
      }
    })
}

// 5. Tests unitarios lentos (probablemente no son unitarios)
for (const t of tests.filter((t) => t.layer === 'unit' && t.duration > config.maxUnitTestMs)) {
  report_('slowUnit', `${t.file} > ${t.name} (${Math.round(t.duration)} ms)`)
}

// 6. Sugerencias: validaciones de input en capas altas (antipatrón cupcake)
const hint = new RegExp(config.lowerLayerHints, 'i')
for (const t of tests.filter((t) => t.layer !== 'unit' && hint.test(t.title))) {
  report_('moveDown', `${t.file} > ${t.title}`)
}

// Salida
const TITLES = {
  pyramid: 'Pirámide invertida (cono de helado)',
  duplicates: 'Tests duplicados',
  weakAssertions: 'Aserciones débiles',
  flaky: 'Patrones flaky',
  slowUnit: 'Tests unitarios lentos',
  moveDown: 'Candidatos a bajar de capa (¿cupcake?)',
}
console.log(
  `\nInventario: ${tests.length} tests → ${Object.entries(count)
    .map(([l, n]) => `${l}: ${n}`)
    .join(', ')}\n`,
)
for (const [kind, messages] of Object.entries(problems)) {
  const level = config.failOn.includes(kind) ? 'ERROR' : 'AVISO'
  console.log(`[${level}] ${TITLES[kind]} (${messages.length})`)
  for (const m of messages) console.log(`   ${m}`)
  console.log()
}

const failed = config.failOn.filter((kind) => problems[kind])
if (failed.length > 0) {
  console.log(`✗ Presupuesto de tests excedido: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('✓ Presupuesto de tests OK')
