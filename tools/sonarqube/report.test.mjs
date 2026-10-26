// Tests del SonarQube efímero que no necesitan Docker: rutas del lcov, resumen de la API y
// coherencia entre sonar-project.properties y lo que prepara run.mjs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { METRIC_KEYS, buildSummary, renderSummaryMarkdown } from './report.mjs'
import { COVERAGE, QUALITY_GATE, readProperties, rewriteLcov } from './run.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const properties = readProperties(readFileSync(join(root, 'sonar-project.properties'), 'utf8'))

describe('sonarqube: preparación del análisis', () => {
  it('corrige las rutas del lcov para que partan desde la raíz del repo', () => {
    const lcov = [
      'TN:',
      'SF:src/books/domain/isbn.ts',
      'DA:3,1',
      'end_of_record',
      `SF:${join(root, 'backend', 'src', 'loans', 'domain', 'loan.ts')}`,
      'end_of_record',
    ].join('\n')
    assert.equal(
      rewriteLcov(lcov, 'backend', root),
      [
        'TN:',
        'SF:backend/src/books/domain/isbn.ts',
        'DA:3,1',
        'end_of_record',
        'SF:backend/src/loans/domain/loan.ts',
        'end_of_record',
      ].join('\n'),
    )
  })

  it('sonar-project.properties lee justo los lcov que escribe run.mjs', () => {
    assert.deepEqual(
      properties['sonar.javascript.lcov.reportPaths'].split(','),
      COVERAGE.map(({ app }) => `reports/sonarqube/lcov/${app}.info`),
    )
    assert.equal(properties['sonar.qualitygate.wait'], 'true')
  })

  it('cada condición de la quality gate es una métrica que se exporta', () => {
    const missing = QUALITY_GATE.conditions.filter((c) => !METRIC_KEYS.includes(c.metric))
    assert.deepEqual(missing, [])
  })
})

describe('sonarqube: resumen del análisis', () => {
  const summary = buildSummary({
    project: { key: 'biblioteca-uc', name: 'Biblioteca UC' },
    serverVersion: '26.10.0.133078',
    gate: {
      name: 'Biblioteca UC',
      conditions: [
        { metric: 'coverage', op: 'LT', error: '80' },
        { metric: 'sqale_rating', op: 'GT', error: '1' },
      ],
    },
    projectStatus: {
      projectStatus: {
        status: 'ERROR',
        conditions: [
          { status: 'ERROR', metricKey: 'coverage', actualValue: '72.35' },
          { status: 'OK', metricKey: 'sqale_rating', actualValue: '1' },
        ],
      },
    },
    measures: {
      component: {
        measures: [
          { metric: 'coverage', value: '72.35' },
          { metric: 'ncloc', value: '3412' },
          { metric: 'sqale_rating', value: '1.0' },
          { metric: 'security_rating', value: '3.0' },
        ],
      },
    },
    issues: {
      total: 3,
      issues: [
        {
          severity: 'MINOR',
          type: 'CODE_SMELL',
          rule: 'typescript:S6759',
          message: 'Mark the props of the component as read-only.',
          component: 'biblioteca-uc:frontend/src/features/catalog/components/BookCard.tsx',
          line: 12,
        },
        {
          severity: 'CRITICAL',
          type: 'BUG',
          rule: 'typescript:S2201',
          message: 'Use or store the return value of "map".',
          component: 'biblioteca-uc:backend/src/loans/application/list-loans.ts',
          line: 20,
        },
        {
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          rule: 'typescript:S3358',
          message: 'Extract this nested ternary | operation.',
          component: 'biblioteca-uc:frontend/src/features/loans/components/LoanList.tsx',
        },
      ],
    },
    hotspots: { paging: { total: 0 }, hotspots: [] },
    top: 2,
  })

  it('convierte notas en letras y deja el issue más grave primero', () => {
    assert.deepEqual(summary.metrics, {
      bugs: null,
      vulnerabilities: null,
      code_smells: null,
      security_hotspots: null,
      coverage: 72.35,
      duplicated_lines_density: null,
      ncloc: 3412,
      reliability_rating: null,
      security_rating: 'C',
      sqale_rating: 'A',
    })
    assert.deepEqual(
      summary.issues.top.map((issue) => `${issue.severity} ${issue.file}:${issue.line}`),
      [
        'CRITICAL backend/src/loans/application/list-loans.ts:20',
        'MAJOR frontend/src/features/loans/components/LoanList.tsx:null',
      ],
    )
    assert.equal(summary.issues.total, 3)
  })

  it('el markdown marca la gate reprobada y la condición que falló', () => {
    const markdown = renderSummaryMarkdown(summary).join('\n')
    assert.match(markdown, /❌ \*\*Quality gate reprobada\*\* \(`Biblioteca UC`\)/)
    assert.match(markdown, /\| Cobertura de los tests unitarios \| mínimo 80 % \| 72,4 % \| ❌ \|/)
    assert.match(markdown, /\| Nota de mantenibilidad \| A o mejor \| A \| ✅ \|/)
    // Una barra en el mensaje rompería la tabla
    assert.match(markdown, /Extract this nested ternary \\\| operation\./)
  })
})
