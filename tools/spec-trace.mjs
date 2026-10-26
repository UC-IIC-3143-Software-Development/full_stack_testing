#!/usr/bin/env node
// Trazabilidad spec a tests (constitución P1 y P4).
//
// Cruza las reglas con ID de las specs con los títulos de los tests:
//   - reglas:  **BOOK-R1 · ...** y **UI-CAT-1** en specs/features/*.md
//   - flujos:  @FLOW-CAT-01 en specs/flows/*.feature (playwright-bdd los vuelve tests)
//   - tests:   it('[BOOK-R1] ...') y test('[UI-CAT-2][UI-CAT-3] ...') en backend y frontend
//
// Falla (exit 1) si:
//   1. una regla no tiene ningún test,
//   2. hay tests huérfanos (sin ID al inicio del título),
//   3. un test cita un ID que no existe en las specs,
//   4. una regla supera el presupuesto de tests en una misma capa (6 por defecto).
//
// Uso: node tools/spec-trace.mjs [--root <dir>] [--max-per-layer 6] [--report-dir reports]
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DEFAULT_MAX_PER_LAYER = 6
// Capas con presupuesto propio. El backend y el frontend son apps distintas: los
// unitarios del dominio del backend y los del frontend no comparten presupuesto.
export const LAYERS = [
  'unit',
  'integration',
  'contract',
  'front-unit',
  'component',
  'mock-contract',
  'e2e',
  'e2e-visual',
  'e2e-style',
  'e2e-layout',
  'e2e-a11y',
]
const LAYER_LABELS = {
  unit: 'unit back',
  integration: 'integración',
  contract: 'contrato API',
  'front-unit': 'unit front',
  component: 'componentes',
  'mock-contract': 'contrato mocks',
  e2e: 'flujos e2e',
  'e2e-visual': 'visual',
  'e2e-style': 'estilos',
  'e2e-layout': 'layout',
  'e2e-a11y': 'a11y',
}

const ID_PATTERN = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+'
// Reglas de negocio que implementa el backend. El contrato de los mocks del frontend
// (capa mock-contract) solo prueba que MSW imita a la API, no que el backend cumpla la
// regla: para darlas por cubiertas hace falta al menos un test de otra capa.
export const BACKEND_RULE = /^(BOOK|LOAN|RENEW)-/
const MOCK_ONLY = 'solo contrato mocks'
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'reports',
  'test-results',
  'playwright-report',
  'blob-report',
  '.features-gen',
  '.stryker-tmp',
  'evidence',
])

// ---------------------------------------------------------------------------
// Lectura de specs
// ---------------------------------------------------------------------------

/** Extrae las reglas definidas en negrita: **BOOK-R1 · Título.** o **UI-CAT-1** texto. */
export function extractRuleIds(markdown) {
  const rules = []
  const re = new RegExp(`\\*\\*(${ID_PATTERN})(?:\\s*·\\s*([^*\\n]+?))?\\*\\*([^\\n]*)`, 'g')
  for (const match of markdown.matchAll(re)) {
    const [, id, shortTitle, rest] = match
    const title = (shortTitle ?? rest).trim().replace(/\.$/, '')
    if (!rules.some((rule) => rule.id === id)) {
      rules.push({ id, title: truncate(title, 90) })
    }
  }
  return rules
}

/** IDs en la primera columna de las tablas de un SPEC.md de capa: | MOCK-R1 | ... | */
export function extractLayerRuleIds(markdown) {
  const rules = []
  const re = new RegExp(`^\\|\\s*(${ID_PATTERN})\\s*\\|\\s*([^|\\n]*)`, 'gm')
  for (const [, id, description] of markdown.matchAll(re)) {
    if (!rules.some((rule) => rule.id === id))
      rules.push({ id, title: truncate(description.trim(), 90) })
  }
  return [...rules, ...extractRuleIds(markdown).filter((r) => !rules.some((x) => x.id === r.id))]
}

const STEP_KEYWORDS =
  /^(?:Dado|Dada|Dados|Dadas|Cuando|Entonces|Y|E|Pero|Given|When|Then|And|But|\*)\s+(.+)$/
const SCENARIO_KEYWORDS =
  /^(?:Escenario|Ejemplo|Esquema del escenario|Plantilla del escenario|Scenario|Scenario Outline|Example):\s*(.*)$/
const BACKGROUND_KEYWORDS = /^(?:Antecedentes|Background):/
const EXAMPLES_KEYWORDS = /^(?:Ejemplos|Escenarios|Examples|Scenarios):/

/** Extrae los escenarios con tag @FLOW-* de un archivo .feature (Gherkin en español o inglés). */
export function extractFlows(featureText) {
  const flows = []
  const background = []
  let pendingTags = []
  let current = null
  let section = 'none'
  let examplesHeader = null

  for (const rawLine of featureText.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    if (line.startsWith('@')) {
      pendingTags.push(...line.split(/\s+/).filter((tag) => tag.startsWith('@')))
      continue
    }
    if (BACKGROUND_KEYWORDS.test(line)) {
      section = 'background'
      continue
    }
    const scenario = line.match(SCENARIO_KEYWORDS)
    if (scenario) {
      const flowTag = pendingTags.find((tag) => /^@FLOW-/.test(tag))
      current = {
        id: flowTag ? flowTag.slice(1) : null,
        title: scenario[1].trim(),
        tags: pendingTags.map((tag) => tag.slice(1)),
        steps: [...background],
      }
      flows.push(current)
      pendingTags = []
      section = 'scenario'
      examplesHeader = null
      continue
    }
    if (EXAMPLES_KEYWORDS.test(line)) {
      section = 'examples'
      continue
    }
    if (section === 'examples' && line.startsWith('|') && current) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
      if (!examplesHeader) {
        examplesHeader = cells
      } else if (!current.examples) {
        // Basta la primera fila para saber si los pasos tienen implementación.
        current.examples = Object.fromEntries(examplesHeader.map((name, i) => [name, cells[i]]))
        current.steps = current.steps.map((step) =>
          step.replace(/<([^>]+)>/g, (_, name) => current.examples[name] ?? `<${name}>`),
        )
      }
      continue
    }
    const step = line.match(STEP_KEYWORDS)
    if (step) {
      if (section === 'background') background.push(step[1].trim())
      else if (current) current.steps.push(step[1].trim())
      continue
    }
    if (!current) pendingTags = []
  }
  return flows.filter((flow) => flow.id)
}

// ---------------------------------------------------------------------------
// Lectura de tests
// ---------------------------------------------------------------------------

/**
 * Recorre el código y devuelve dos máscaras del mismo largo:
 *  - noComments: el código sin comentarios (los strings quedan intactos)
 *  - codeOnly: además vacía el contenido de strings, templates y regex
 * Así se buscan llamadas en codeOnly sin confundirse con texto dentro de strings,
 * y se lee el título real desde noComments en la misma posición.
 */
export function maskSource(source) {
  const noComments = source.split('')
  const codeOnly = source.split('')
  const blank = (arr, from, to) => {
    let k = from
    while (k < to) {
      if (arr[k] !== '\n') arr[k] = ' '
      k += 1
    }
  }
  let i = 0
  let lastSignificant = ''
  const templateDepth = []

  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]

    if (templateDepth.length > 0 && ch === '}' && templateDepth.at(-1) === 0) {
      // Cierra una interpolación ${...} y vuelve al template
      templateDepth.pop()
      const end = readTemplate(source, i + 1, templateDepth)
      blank(codeOnly, i + 1, end - 1)
      i = end
      lastSignificant = '`'
      continue
    }
    if (templateDepth.length > 0 && (ch === '{' || ch === '}')) {
      templateDepth[templateDepth.length - 1] += ch === '{' ? 1 : -1
    }

    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      blank(noComments, i, stop)
      blank(codeOnly, i, stop)
      i = stop
      continue
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      blank(noComments, i, stop)
      blank(codeOnly, i, stop)
      i = stop
      continue
    }
    if (ch === "'" || ch === '"') {
      const end = readQuoted(source, i)
      blank(codeOnly, i + 1, end - 1)
      i = end
      lastSignificant = ch
      continue
    }
    if (ch === '`') {
      const end = readTemplate(source, i + 1, templateDepth)
      blank(codeOnly, i + 1, end - 1)
      i = end
      lastSignificant = '`'
      continue
    }
    if (ch === '/' && (lastSignificant === '' || /[(,=:[!&|?{}+\-*%<>~^]/.test(lastSignificant))) {
      const end = readRegex(source, i)
      blank(codeOnly, i + 1, end - 1)
      i = end
      lastSignificant = '/'
      continue
    }
    if (!/\s/.test(ch)) lastSignificant = ch
    i += 1
  }
  return { noComments: noComments.join(''), codeOnly: codeOnly.join('') }
}

function readQuoted(source, start) {
  const quote = source[start]
  let i = start + 1
  while (i < source.length) {
    if (source[i] === '\\') i += 2
    else if (source[i] === quote || source[i] === '\n') return i + 1
    else i += 1
  }
  return source.length
}

/** Avanza hasta el cierre del template. Si encuentra ${, deja la interpolación abierta. */
function readTemplate(source, start, templateDepth) {
  let i = start
  while (i < source.length) {
    if (source[i] === '\\') i += 2
    else if (source[i] === '`') return i + 1
    else if (source[i] === '$' && source[i + 1] === '{') {
      templateDepth.push(0)
      return i + 2
    } else i += 1
  }
  return source.length
}

function readRegex(source, start) {
  let i = start + 1
  let inClass = false
  while (i < source.length && source[i] !== '\n') {
    const ch = source[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '/' && !inClass) {
      i += 1
      while (/[a-z]/i.test(source[i] ?? '')) i += 1
      return i
    }
    if (ch === '[') inClass = true
    if (ch === ']') inClass = false
    i += 1
  }
  return i
}

/**
 * Lee un string literal desde `start` (que apunta a la comilla).
 * Devuelve su contenido y el índice siguiente a la comilla de cierre.
 */
function readLiteral(text, start) {
  const quote = text[start]
  let i = start + 1
  let depth = 0
  let value = ''
  while (i < text.length) {
    const ch = text[i]
    if (ch === '\\') {
      value += text[i + 1] ?? ''
      i += 2
      continue
    }
    if (quote === '`' && ch === '$' && text[i + 1] === '{') depth += 1
    if (quote === '`' && ch === '}' && depth > 0) depth -= 1
    if (ch === quote && depth === 0) return { value, end: i + 1 }
    value += ch
    i += 1
  }
  return { value, end: text.length }
}

/** Salta un bloque balanceado que empieza en `start` ( '(' o '[' ) y devuelve el índice siguiente. */
function skipBalanced(code, start) {
  const open = code[start]
  const close = open === '(' ? ')' : ']'
  let depth = 0
  let i = start
  while (i < code.length) {
    if (code[i] === open) depth += 1
    if (code[i] === close) {
      depth -= 1
      if (depth === 0) return i + 1
    }
    i += 1
  }
  return code.length
}

/** Cuenta los elementos de primer nivel de un arreglo literal: [[1, 2], [3, 4]] tiene 2. */
function countArrayItems(code, start) {
  const end = skipBalanced(code, start)
  let depth = 0
  let items = 0
  let hasContent = false
  let i = start
  while (i < end - 2) {
    i += 1
    const ch = code[i]
    if ('([{'.includes(ch)) depth += 1
    if (')]}'.includes(ch)) depth -= 1
    if (depth === 0 && ch === ',') {
      if (hasContent) items += 1
      hasContent = false
    } else if (!/\s/.test(ch)) {
      hasContent = true
    }
  }
  return items + (hasContent ? 1 : 0)
}

const TEST_CALL =
  /(?<![.\w$])(it|test)((?:\.(?:only|skip|concurrent|fixme|fail|failing|todo|sequential))*)(\.each)?\b/g

/**
 * Devuelve los tests declarados en un archivo: título, línea y cuántos casos genera.
 * Un it.each con un arreglo literal de 4 filas cuenta como 4 tests (el presupuesto
 * de P4 no se esquiva parametrizando).
 */
export function extractTests(source) {
  const { noComments, codeOnly } = maskSource(source)
  const tests = []
  let dynamicTitles = false
  for (const match of codeOnly.matchAll(TEST_CALL)) {
    let i = match.index + match[0].length
    let count = 1
    let parametrized = false
    const skipSpaces = () => {
      while (/\s/.test(codeOnly[i] ?? '')) i += 1
    }
    skipSpaces()
    if (match[3]) {
      parametrized = true
      if (codeOnly[i] === '(') {
        let inner = i + 1
        while (/\s/.test(codeOnly[inner] ?? '')) inner += 1
        if (codeOnly[inner] === '[') count = Math.max(1, countArrayItems(codeOnly, inner))
        i = skipBalanced(codeOnly, i)
      } else if (codeOnly[i] === '`') {
        const table = readLiteral(noComments, i)
        const rows = table.value.split('\n').filter((row) => row.trim() !== '')
        count = Math.max(1, rows.length - 1)
        i = table.end
      } else {
        continue
      }
      skipSpaces()
    }
    if (codeOnly[i] !== '(') continue
    i += 1
    skipSpaces()
    const quote = codeOnly[i]
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      // it(testCase.title, ...) dentro de un for: el título no es un literal
      if (/[A-Za-z_$]/.test(quote ?? '')) dynamicTitles = true
      continue
    }
    const title = readLiteral(noComments, i).value
    const line = source.slice(0, match.index).split('\n').length
    tests.push({ title, line, count, parametrized })
  }
  if (dynamicTitles) {
    // Tests de tabla: cada { title: '[ID] ...' } del archivo es un test
    const re = new RegExp(`\\btitle\\s*:\\s*(['"\`])(\\[${ID_PATTERN}\\][^'"\`\\n]*)\\1`, 'g')
    for (const match of noComments.matchAll(re)) {
      const line = source.slice(0, match.index).split('\n').length
      tests.push({ title: match[2], line, count: 1, parametrized: true })
    }
  }
  return tests
}

/** IDs al inicio del título: "[LOAN-R2][LOAN-R4] rechaza..." devuelve ["LOAN-R2", "LOAN-R4"]. */
export function parseTitleIds(title) {
  const prefix = title.match(new RegExp(`^\\s*((?:\\[${ID_PATTERN}\\]\\s*)+)`))
  if (!prefix) return []
  return [...prefix[1].matchAll(new RegExp(`\\[(${ID_PATTERN})\\]`, 'g'))].map((m) => m[1])
}

/** Clasifica un archivo de test en una capa según su ruta y sufijo. */
export function classifyLayer(relPath) {
  const path = relPath.split(sep).join('/')
  if (path.startsWith('backend/')) {
    if (/\.int-spec\.ts$/.test(path)) return 'integration'
    if (/\.contract\.spec\.ts$/.test(path) || /\/contract\//.test(path)) return 'contract'
    if (/\.e2e-spec\.ts$/.test(path)) return 'contract'
    // Los fakes en memoria se prueban como unitarios (mismo contrato que el repositorio real)
    if (/\/fakes\//.test(path)) return 'unit'
    if (path.startsWith('backend/test/')) return 'integration'
    return 'unit'
  }
  if (path.startsWith('frontend/tests/')) {
    const kind = path.match(/\.(visual|style|layout|a11y)\.spec\.ts$/)
    return kind ? `e2e-${kind[1]}` : 'e2e'
  }
  if (/\.contract\.(test|spec)\.tsx?$/.test(path)) return 'mock-contract'
  if (/\/mocks\//.test(path) || /\/shared\/api\//.test(path)) return 'mock-contract'
  if (/\/shared\/domain\//.test(path)) return 'front-unit'
  if (/\/features\/[^/]+\/(components|hooks)\//.test(path)) return 'component'
  return /\.tsx$/.test(path) ? 'component' : 'front-unit'
}

/** Decide si una ruta relativa es un archivo de test que hay que revisar. */
export function isTestFile(relPath) {
  const path = relPath.split(sep).join('/')
  if (path.startsWith('backend/src/')) return /\.(spec|int-spec)\.ts$/.test(path)
  if (path.startsWith('backend/')) {
    return (
      /\.contract\.spec\.ts$/.test(path) ||
      (path.startsWith('backend/test/') && /\.(spec|test|int-spec|e2e-spec)\.ts$/.test(path))
    )
  }
  if (path.startsWith('frontend/src/')) return /\.(test|spec)\.tsx?$/.test(path)
  if (path.startsWith('frontend/tests/')) return /\.(spec|test)\.ts$/.test(path)
  return false
}

// ---------------------------------------------------------------------------
// Steps de playwright-bdd
// ---------------------------------------------------------------------------

const PARAMETER_TYPES = {
  string: `(?:"[^"]*"|'[^']*')`,
  int: '-?\\d+',
  float: '-?\\d*\\.?\\d+',
  word: '[^\\s]+',
  '': '.*',
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Convierte una Cucumber Expression ("pido prestado {string}") a una RegExp. */
export function cucumberExpressionToRegex(expression) {
  const tokens = expression.split(' ')
  const parts = tokens.map((token) => {
    if (token.includes('/') && !/[{(]/.test(token)) {
      return `(?:${token.split('/').map(escapeRegex).join('|')})`
    }
    let out = ''
    let i = 0
    while (i < token.length) {
      const ch = token[i]
      if (ch === '\\') {
        out += escapeRegex(token[i + 1] ?? '')
        i += 2
      } else if (ch === '{') {
        const end = token.indexOf('}', i)
        const name = token.slice(i + 1, end)
        out += PARAMETER_TYPES[name] ?? '.*'
        i = end + 1
      } else if (ch === '(') {
        const end = token.indexOf(')', i)
        out += `(?:${escapeRegex(token.slice(i + 1, end))})?`
        i = end + 1
      } else {
        out += escapeRegex(ch)
        i += 1
      }
    }
    return out
  })
  // nosemgrep: detect-non-literal-regexp (la expresión viene de los steps del repo, no de usuarios)
  return new RegExp(`^${parts.join(' ')}$`)
}

const STEP_CALL = /(?<![.\w$])(Given|When|Then|Step|And|But|Dado|Cuando|Entonces)\s*\(\s*/g

/** Extrae las definiciones de steps (Given/When/Then) de un archivo de steps. */
export function extractStepDefinitions(source) {
  const { noComments, codeOnly } = maskSource(source)
  const definitions = []
  for (const match of codeOnly.matchAll(STEP_CALL)) {
    const i = match.index + match[0].length
    const quote = codeOnly[i]
    if (quote === "'" || quote === '"' || quote === '`') {
      const expression = readLiteral(noComments, i).value
      definitions.push({ expression, regex: cucumberExpressionToRegex(expression) })
    } else if (quote === '/') {
      const end = readRegex(noComments, i)
      const literal = noComments.slice(i, end)
      const lastSlash = literal.lastIndexOf('/')
      try {
        // nosemgrep: detect-non-literal-regexp (regex escrita en un step del repo)
        const regex = new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1))
        definitions.push({ expression: literal, regex })
      } catch {
        // Una regex inválida no es un step utilizable
      }
    }
  }
  return definitions
}

// ---------------------------------------------------------------------------
// Análisis
// ---------------------------------------------------------------------------

function walk(dir, root, files = []) {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, root, files)
    else files.push(relative(root, full).split(sep).join('/'))
  }
  return files
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

export function analyze({ root, maxPerLayer = DEFAULT_MAX_PER_LAYER }) {
  const rules = new Map()
  const addRule = (rule) => {
    if (!rules.has(rule.id)) {
      rules.set(rule.id, { ...rule, layers: {}, tests: [], total: 0 })
    }
  }

  // 1. Reglas de features (obligatorias) y de arquitectura (las verifica dependency-cruiser)
  for (const file of walk(join(root, 'specs/features'), root).filter((f) => f.endsWith('.md'))) {
    for (const rule of extractRuleIds(readFileSync(join(root, file), 'utf8'))) {
      addRule({ ...rule, kind: 'rule', source: file, required: true })
    }
  }
  const architecture = join(root, 'specs/architecture.md')
  if (existsSync(architecture)) {
    for (const rule of extractRuleIds(readFileSync(architecture, 'utf8'))) {
      addRule({ ...rule, kind: 'arch', source: 'specs/architecture.md', required: false })
    }
  }
  // Reglas propias de una capa (tabla "Reglas que implementa" de cada SPEC.md).
  // Son técnicas, no de negocio: si no tienen tests se avisa, pero no se bloquea.
  const layerSpecs = [
    ...walk(join(root, 'backend/src'), root),
    ...walk(join(root, 'frontend/src'), root),
  ]
  for (const file of layerSpecs.filter((f) => f.endsWith('/SPEC.md'))) {
    for (const rule of extractLayerRuleIds(readFileSync(join(root, file), 'utf8'))) {
      addRule({ ...rule, kind: 'layer', source: file, required: false })
    }
  }
  // El ID de un documento de spec (SPEC-ARCH-01) se acepta para tests transversales
  for (const file of walk(join(root, 'specs'), root).filter((f) => f.endsWith('.md'))) {
    const specId = readFileSync(join(root, file), 'utf8').match(
      /^\|\s*ID\s*\|\s*(SPEC-[A-Z0-9-]+)/m,
    )
    if (specId)
      addRule({
        id: specId[1],
        title: 'documento de spec',
        kind: 'spec',
        source: file,
        required: false,
      })
  }

  // 2. Flujos de usuario
  const flows = []
  for (const file of walk(join(root, 'specs/flows'), root).filter((f) => f.endsWith('.feature'))) {
    for (const flow of extractFlows(readFileSync(join(root, file), 'utf8'))) {
      flows.push({ ...flow, source: file })
      addRule({
        id: flow.id,
        title: flow.title,
        kind: 'flow',
        source: file,
        required: true,
        smoke: flow.tags.includes('smoke'),
      })
    }
  }

  // 3. Steps implementados en el frontend
  const allFiles = [...walk(join(root, 'backend'), root), ...walk(join(root, 'frontend'), root)]
  const stepDefinitions = allFiles
    .filter((f) => f.startsWith('frontend/tests/') && /\.(ts|js|mjs)$/.test(f))
    .flatMap((f) =>
      extractStepDefinitions(readFileSync(join(root, f), 'utf8')).map((d) => ({ ...d, file: f })),
    )

  for (const flow of flows) {
    const missingSteps = flow.steps.filter(
      (step) => !stepDefinitions.some((definition) => definition.regex.test(step)),
    )
    const rule = rules.get(flow.id)
    rule.missingSteps = missingSteps
    if (missingSteps.length === 0 && flow.steps.length > 0) {
      rule.layers.e2e = (rule.layers.e2e ?? 0) + 1
      rule.total += 1
      rule.tests.push({ file: flow.source, title: flow.title, layer: 'e2e', count: 1 })
    }
  }

  // 4. Tests de backend y frontend
  const orphans = []
  const unknown = []
  let totalTests = 0
  const testFiles = allFiles.filter(isTestFile)
  for (const file of testFiles) {
    const layer = classifyLayer(file)
    for (const test of extractTests(readFileSync(join(root, file), 'utf8'))) {
      totalTests += test.count
      const ids = parseTitleIds(test.title)
      const entry = { file, line: test.line, title: test.title, layer, count: test.count }
      if (ids.length === 0) {
        orphans.push(entry)
        continue
      }
      const missing = ids.filter((id) => !rules.has(id))
      if (missing.length > 0) unknown.push({ ...entry, ids: missing })
      for (const id of ids.filter((known) => rules.has(known))) {
        const rule = rules.get(id)
        rule.layers[layer] = (rule.layers[layer] ?? 0) + test.count
        rule.total += test.count
        rule.tests.push(entry)
      }
    }
  }

  // 5. Veredicto por regla
  const overBudget = []
  for (const rule of rules.values()) {
    const exceeded = Object.entries(rule.layers).filter(([, count]) => count > maxPerLayer)
    for (const [layer, count] of exceeded) {
      overBudget.push({ id: rule.id, layer, count, max: maxPerLayer })
    }
    const outsideMocks = rule.total - (rule.layers['mock-contract'] ?? 0)
    if (rule.required && rule.total === 0) rule.status = 'sin tests'
    else if (rule.required && BACKEND_RULE.test(rule.id) && outsideMocks === 0)
      rule.status = MOCK_ONLY
    else if (exceeded.length > 0) rule.status = 'excede presupuesto'
    else if (rule.kind === 'arch' && rule.total === 0) rule.status = 'test:arch'
    else if (rule.total === 0) rule.status = 'aviso: sin tests'
    else rule.status = 'ok'
  }

  // Los IDs de documentos de spec solo se muestran si algún test los cita
  const ruleList = [...rules.values()].filter((rule) => rule.kind !== 'spec' || rule.total > 0)
  const uncovered = ruleList.filter((rule) => ['sin tests', MOCK_ONLY].includes(rule.status))
  const required = ruleList.filter((rule) => rule.required)
  const ok = uncovered.length === 0 && orphans.length === 0 && unknown.length === 0
  return {
    generatedAt: new Date().toISOString(),
    maxPerLayer,
    summary: {
      ok: ok && overBudget.length === 0,
      requiredRules: required.length,
      coveredRules: required.length - uncovered.length,
      uncoveredRules: uncovered.length,
      testFiles: testFiles.length,
      tests: totalTests,
      stepDefinitions: stepDefinitions.length,
      orphans: orphans.length,
      unknownIds: unknown.length,
      overBudget: overBudget.length,
    },
    rules: ruleList,
    orphans,
    unknown,
    overBudget,
  }
}

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

const STATUS_ICON = {
  ok: '✅',
  'sin tests': '❌',
  [MOCK_ONLY]: '❌',
  'excede presupuesto': '❌',
  'test:arch': '🏛️',
  'aviso: sin tests': '⚠️',
}

export function toMarkdown(report) {
  const { summary } = report
  const usedLayers = LAYERS.filter((layer) => report.rules.some((rule) => rule.layers[layer]))
  const lines = []
  lines.push('## Trazabilidad spec a tests')
  lines.push('')
  lines.push(
    `${summary.ok ? '✅' : '❌'} **${summary.coveredRules} de ${summary.requiredRules} reglas y flujos con tests** · ` +
      `${summary.tests} tests en ${summary.testFiles} archivos · ` +
      `${summary.orphans} huérfanos · ${summary.unknownIds} con ID inexistente · ` +
      `${summary.overBudget} sobre el presupuesto de ${report.maxPerLayer} por capa`,
  )
  lines.push('')
  lines.push(`| Regla | Spec | ${usedLayers.map((l) => LAYER_LABELS[l]).join(' | ')} | Estado |`)
  lines.push(`| --- | --- | ${usedLayers.map(() => ':---:').join(' | ')} | --- |`)
  for (const rule of report.rules) {
    const cells = usedLayers.map((layer) => rule.layers[layer] ?? '·')
    const spec = rule.source.split('/').pop()
    lines.push(
      `| **${rule.id}** ${rule.title} | ${spec} | ${cells.join(' | ')} | ${STATUS_ICON[rule.status]} ${rule.status} |`,
    )
  }
  const flowsWithGaps = report.rules.filter((rule) => rule.missingSteps?.length > 0)
  if (flowsWithGaps.length > 0) {
    lines.push('', '### Flujos con pasos sin implementar', '')
    for (const rule of flowsWithGaps) {
      lines.push(`- **${rule.id}**: ${rule.missingSteps.map((step) => `"${step}"`).join(', ')}`)
    }
  }
  if (report.orphans.length > 0) {
    lines.push('', '### Tests huérfanos (sin ID de regla en el título)', '')
    for (const test of report.orphans) lines.push(`- \`${test.file}:${test.line}\` ${test.title}`)
  }
  if (report.unknown.length > 0) {
    lines.push('', '### Tests que citan IDs que no existen en las specs', '')
    for (const test of report.unknown) {
      lines.push(`- \`${test.file}:${test.line}\` ${test.ids.join(', ')} en "${test.title}"`)
    }
  }
  if (report.overBudget.length > 0) {
    lines.push('', `### Reglas sobre el presupuesto de ${report.maxPerLayer} tests por capa`, '')
    for (const item of report.overBudget) {
      lines.push(`- **${item.id}** tiene ${item.count} tests en la capa ${item.layer}`)
    }
  }
  lines.push('')
  lines.push(
    '_🏛️ test:arch: reglas de arquitectura, las verifica dependency-cruiser. ⚠️ regla de una capa sin tests: se avisa, no bloquea. ' +
      'Un test parametrizado cuenta una vez por fila. Una regla BOOK, LOAN o RENEW necesita al menos un test fuera del contrato de los mocks._',
  )
  return `${lines.join('\n')}\n`
}

function toConsole(report) {
  const usedLayers = LAYERS.filter((layer) => report.rules.some((rule) => rule.layers[layer]))
  const header = ['Regla', ...usedLayers, 'Estado']
  const rows = report.rules.map((rule) => [
    rule.id,
    ...usedLayers.map((layer) => String(rule.layers[layer] ?? '·')),
    rule.status,
  ])
  const widths = header.map((h, col) => Math.max(h.length, ...rows.map((row) => row[col].length)))
  const format = (row) => row.map((cell, col) => cell.padEnd(widths[col])).join('  ')
  const out = [format(header), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(format)]
  for (const test of report.orphans) out.push(`HUÉRFANO   ${test.file}:${test.line} ${test.title}`)
  for (const test of report.unknown) {
    out.push(`ID NO EXISTE ${test.ids.join(', ')}  ${test.file}:${test.line}`)
  }
  for (const item of report.overBudget) {
    out.push(`PRESUPUESTO ${item.id} tiene ${item.count} tests en ${item.layer} (máx. ${item.max})`)
  }
  for (const rule of report.rules.filter((r) => r.missingSteps?.length > 0)) {
    out.push(`PASOS SIN IMPLEMENTAR ${rule.id}: ${rule.missingSteps.join(' | ')}`)
  }
  const s = report.summary
  out.push('')
  out.push(
    `${s.ok ? 'OK' : 'FALLA'}: ${s.coveredRules}/${s.requiredRules} reglas cubiertas, ${s.tests} tests, ` +
      `${s.orphans} huérfanos, ${s.unknownIds} IDs inexistentes, ${s.overBudget} sobre presupuesto`,
  )
  return out.join('\n')
}

function parseArgs(argv) {
  const args = {}
  const queue = [...argv]
  while (queue.length > 0) {
    const [key, inlineValue] = queue.shift().replace(/^--/, '').split('=')
    if (inlineValue !== undefined) args[key] = inlineValue
    else if (queue[0] && !queue[0].startsWith('--')) args[key] = queue.shift()
    else args[key] = true
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const root = resolve(args.root ?? defaultRoot)
  const maxPerLayer = Number(args['max-per-layer'] ?? DEFAULT_MAX_PER_LAYER)
  const reportDir = resolve(root, args['report-dir'] ?? 'reports')

  const report = analyze({ root, maxPerLayer })
  const markdown = toMarkdown(report)
  mkdirSync(reportDir, { recursive: true })
  writeFileSync(join(reportDir, 'spec-trace.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(reportDir, 'spec-trace.md'), markdown)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)

  console.log(toConsole(report))
  const shown = relative(process.cwd(), reportDir)
  console.log(
    `\nReportes: ${shown.startsWith('..') ? reportDir : shown || '.'}/spec-trace.{json,md}`,
  )
  process.exitCode = report.summary.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
