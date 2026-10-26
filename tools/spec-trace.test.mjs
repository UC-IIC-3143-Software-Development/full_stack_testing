// Tests de la herramienta de trazabilidad. Usan mini repositorios sintéticos
// en tools/__fixtures__/spec-trace porque backend y frontend evolucionan aparte.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  analyze,
  classifyLayer,
  cucumberExpressionToRegex,
  extractFlows,
  extractLayerRuleIds,
  extractRuleIds,
  extractTests,
  parseTitleIds,
} from './spec-trace.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => join(here, '__fixtures__', 'spec-trace', name)

describe('spec-trace: lectura de specs', () => {
  it('extrae reglas en negrita con título corto y reglas de UI sin título corto', () => {
    const rules = extractRuleIds(
      '- **LOAN-R2 · Límite por persona.** Máximo 3.\n- **UI-LOAN-1** En el detalle del libro\n',
    )
    assert.deepEqual(rules, [
      { id: 'LOAN-R2', title: 'Límite por persona' },
      { id: 'UI-LOAN-1', title: 'En el detalle del libro' },
    ])
  })

  it('lee las reglas propias de un SPEC.md de capa desde su tabla', () => {
    const rules = extractLayerRuleIds(
      '| Regla | Descripción |\n| --- | --- |\n| MOCK-R1 | Un handler por operación |\n',
    )
    assert.deepEqual(rules, [{ id: 'MOCK-R1', title: 'Un handler por operación' }])
  })

  it('no confunde el ID de la spec en una tabla con una regla', () => {
    assert.deepEqual(extractRuleIds('| ID | SPEC-LIB-01 · versión 1 |\n| BOOK-R1 | unit |'), [])
  })

  it('extrae flujos con antecedentes y reemplaza los parámetros del esquema', () => {
    const flows = extractFlows(
      readFileSync(join(fixture('ok'), 'specs/flows/catalogo.feature'), 'utf8'),
    )
    assert.deepEqual(
      flows.map((flow) => [flow.id, flow.steps]),
      [
        ['FLOW-CAT-01', ['que estoy en el catálogo', 'busco "garcia"', 'veo 1 libro']],
        ['FLOW-CAT-02', ['que estoy en el catálogo', 'busco "borges"', 'veo 2 libros']],
      ],
    )
  })
})

describe('spec-trace: lectura de tests', () => {
  it('ignora tests comentados y textos que parecen tests dentro de strings', () => {
    const source = [
      "// it('[X-R1] comentado', () => {})",
      'const s = "it(\'[X-R1] dentro de un string\')"',
      "it('[X-R1] real', () => {})",
    ].join('\n')
    assert.deepEqual(
      extractTests(source).map((t) => [t.title, t.line]),
      [['[X-R1] real', 3]],
    )
  })

  it('cuenta cada fila de un it.each y de una tabla con template literal', () => {
    const source = [
      "it.each([[1, 'a'], [2, 'b'], [3, 'c']])('[X-R1] caso %s', () => {})",
      'test.each`',
      '  a    | b',
      '  ${1} | ${2}',
      '  ${3} | ${4}',
      "`('[X-R2] tabla $a', () => {})",
    ].join('\n')
    assert.deepEqual(
      extractTests(source).map((t) => [t.title, t.count]),
      [
        ['[X-R1] caso %s', 3],
        ['[X-R2] tabla $a', 2],
      ],
    )
  })

  it('no cuenta test.describe, test.step ni test.skip condicional como tests', () => {
    const source = [
      "test.describe('[X-R1] grupo', () => {",
      "  test('[X-R1] uno', async () => {",
      "    test.skip(process.env.CI === 'true', 'motivo')",
      "    await test.step('[X-R1] paso', async () => {})",
      '  })',
      '})',
    ].join('\n')
    assert.deepEqual(
      extractTests(source).map((t) => t.title),
      ['[X-R1] uno'],
    )
  })

  it('cuenta los títulos de un test de tabla (it(testCase.title) dentro de un for)', () => {
    const source = [
      "const CASES = [{ title: '[X-R1] uno' }, { title: '[X-R2] dos' }, { name: 'Rayuela' }]",
      'for (const testCase of CASES) {',
      '  it(testCase.title, () => {})',
      '}',
    ].join('\n')
    assert.deepEqual(
      extractTests(source).map((t) => t.title),
      ['[X-R1] uno', '[X-R2] dos'],
    )
  })

  it('lee uno o varios IDs al inicio del título y nada más', () => {
    assert.deepEqual(parseTitleIds('[LOAN-R2][LOAN-R4] rechaza'), ['LOAN-R2', 'LOAN-R4'])
    assert.deepEqual(parseTitleIds('[UI-CAT-2] [UI-CAT-3] insignia'), ['UI-CAT-2', 'UI-CAT-3'])
    assert.deepEqual(parseTitleIds('rechaza [LOAN-R2]'), [])
    assert.deepEqual(parseTitleIds('[loan-r2] minúsculas'), [])
  })

  it('clasifica la capa por ruta y sufijo', () => {
    const cases = {
      'backend/src/books/domain/isbn.spec.ts': 'unit',
      'backend/src/books/infrastructure/book.repository.int-spec.ts': 'integration',
      'backend/test/books.contract.spec.ts': 'contract',
      'backend/test/fakes/in-memory-repositories.spec.ts': 'unit',
      'frontend/src/shared/domain/isbn.test.ts': 'front-unit',
      'frontend/src/features/catalog/components/BookCard.test.tsx': 'component',
      'frontend/src/mocks/handlers.contract.test.ts': 'mock-contract',
      'frontend/tests/visual/catalog.visual.spec.ts': 'e2e-visual',
      'frontend/tests/style/loans.style.spec.ts': 'e2e-style',
      'frontend/tests/layout/catalog.layout.spec.ts': 'e2e-layout',
      'frontend/tests/a11y/catalog.a11y.spec.ts': 'e2e-a11y',
    }
    for (const [path, layer] of Object.entries(cases))
      assert.equal(classifyLayer(path), layer, path)
  })

  it('convierte Cucumber Expressions con parámetros, opcionales y alternativas', () => {
    const regex = cucumberExpressionToRegex('pido prestado {string} con {int} copia(s) hoy/mañana')
    assert.equal(regex.test('pido prestado "Rayuela" con 2 copias hoy'), true)
    assert.equal(regex.test('pido prestado "Rayuela" con 1 copia mañana'), true)
    assert.equal(regex.test('pido prestado Rayuela con 1 copia hoy'), false)
  })
})

describe('spec-trace: análisis completo', () => {
  it('aprueba un repo donde cada regla y flujo tiene tests', () => {
    const report = analyze({ root: fixture('ok') })
    assert.equal(report.summary.ok, true)
    const byId = Object.fromEntries(report.rules.map((rule) => [rule.id, rule]))
    assert.deepEqual(byId['CAT-R1'].layers, { unit: 3, contract: 1, 'mock-contract': 1 })
    assert.deepEqual(byId['MOCK-R1'].layers, { 'mock-contract': 1 })
    assert.deepEqual(byId['FLOW-CAT-01'].layers, { e2e: 1, 'e2e-visual': 1 })
    assert.equal(byId['ARCH-R1'].status, 'test:arch')
  })

  it('detecta regla sin tests, huérfano, ID inexistente, presupuesto y paso sin implementar', () => {
    const report = analyze({ root: fixture('bad') })
    const byId = Object.fromEntries(report.rules.map((rule) => [rule.id, rule]))
    assert.equal(report.summary.ok, false)
    assert.equal(byId['CAT-R1'].status, 'sin tests')
    assert.deepEqual(report.overBudget, [{ id: 'CAT-R2', layer: 'unit', count: 7, max: 6 }])
    assert.deepEqual(
      report.orphans.map((t) => t.title),
      ['normaliza el texto'],
    )
    assert.deepEqual(
      report.unknown.map((t) => t.ids),
      [['NOPE-R9']],
    )
    assert.deepEqual(byId['FLOW-CAT-01'].missingSteps, ['ordeno por año'])
  })

  it('la CLI termina con código 1 si falla y escribe los reportes JSON y markdown', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'spec-trace-'))
    const run = spawnSync(
      process.execPath,
      [join(here, 'spec-trace.mjs'), '--root', fixture('bad'), '--report-dir', reportDir],
      { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } },
    )
    assert.equal(run.status, 1)
    const json = JSON.parse(readFileSync(join(reportDir, 'spec-trace.json'), 'utf8'))
    assert.equal(json.summary.uncoveredRules, 2)
    assert.match(readFileSync(join(reportDir, 'spec-trace.md'), 'utf8'), /Tests huérfanos/)
  })

  it('la CLI termina con código 0 cuando todo está trazado', () => {
    const reportDir = mkdtempSync(join(tmpdir(), 'spec-trace-'))
    const run = spawnSync(
      process.execPath,
      [join(here, 'spec-trace.mjs'), '--root', fixture('ok'), '--report-dir', reportDir],
      { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } },
    )
    assert.equal(run.status, 0, run.stdout + run.stderr)
  })
})
