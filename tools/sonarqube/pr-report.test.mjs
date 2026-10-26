// Tests del comentario del bot de SonarQube en el PR (código nuevo). No necesitan Docker: usan
// respuestas de la API guardadas en tools/__fixtures__/sonarqube/pr-api.json.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PR_COMMENT_MARKER, PR_METRIC_KEYS, buildPrReport, renderPrComment } from './pr-report.mjs'
import { QUALITY_GATE_PR, scannerArgs, toSonarDate } from './run.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const api = JSON.parse(
  readFileSync(join(root, 'tools', '__fixtures__', 'sonarqube', 'pr-api.json'), 'utf8'),
)
const project = { key: 'biblioteca-uc', name: 'Biblioteca UC' }
const baseSha = '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const headSha = '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const links = {
  serverUrl: 'https://github.com',
  repository: 'uc/full_stack_testing',
  runUrl: 'https://github.com/uc/full_stack_testing/actions/runs/42',
}

const report = buildPrReport({
  project,
  serverVersion: '26.10.0.133078',
  gate: QUALITY_GATE_PR,
  ...api,
  baseSha,
  headSha,
})
const comment = renderPrComment(report, links)

describe('sonarqube PR: análisis de la base y del HEAD', () => {
  it('la base lleva la fecha de su commit en el formato de sonar.projectDate', () => {
    assert.equal(toSonarDate('1772452800'), '2026-03-02T12:00:00+0000')
  })

  it('la base va sin cobertura y las dos corridas usan el properties del HEAD con git blame', () => {
    const base = scannerArgs('base', { baseDate: '2026-03-02T12:00:00+0000' })
    const pr = scannerArgs('pr')
    for (const args of [base, pr]) {
      assert.ok(args.includes('-Dsonar.scm.disabled=false'))
      assert.ok(args.some((arg) => arg.startsWith('-Dproject.settings=/usr/src/reports/')))
    }
    assert.ok(base.includes('-Dsonar.projectVersion=base'))
    assert.ok(base.includes('-Dsonar.javascript.lcov.reportPaths='))
    assert.ok(pr.includes('-Dsonar.projectVersion=pr'))
    assert.ok(!pr.some((arg) => arg.startsWith('-Dsonar.javascript.lcov.reportPaths')))
    assert.deepEqual(scannerArgs('full'), [])
  })

  it('cada condición de la quality gate del PR es una métrica del código nuevo que se exporta', () => {
    const missing = QUALITY_GATE_PR.conditions.filter((c) => !PR_METRIC_KEYS.includes(c.metric))
    assert.deepEqual(missing, [])
    assert.ok(QUALITY_GATE_PR.conditions.every((c) => c.metric.startsWith('new_')))
  })
})

describe('sonarqube PR: comentario del bot', () => {
  it('lee las métricas del código nuevo aunque vengan en period o periods', () => {
    assert.equal(report.metrics.new_reliability_rating, 'C')
    assert.equal(report.metrics.new_maintainability_rating, 'B')
    assert.equal(report.metrics.new_coverage, 64.5)
    assert.equal(report.metrics.new_lines, 142)
  })

  it('lleva el marcador propio y el título para que el bot actualice su comentario', () => {
    assert.ok(comment.startsWith(`${PR_COMMENT_MARKER}\n## SonarQube · código nuevo de este PR`))
    assert.match(comment, /❌ \*\*Quality gate reprobada\*\* \(`Biblioteca UC \(código nuevo\)`\)/)
    assert.match(comment, /\*\*142 líneas nuevas\*\*/)
  })

  it('muestra las tres notas con color, la cobertura y la duplicación del código nuevo', () => {
    assert.match(comment, /\| Confiabilidad \(1 bug\) \| 🟡 \*\*C\*\* \| A o mejor \| ❌ \|/)
    assert.match(
      comment,
      /\| Seguridad \(0 vulnerabilidades\) \| 🟢 \*\*A\*\* \| A o mejor \| ✅ \|/,
    )
    assert.match(comment, /\| Mantenibilidad \(2 code smells\) \| 🟡 \*\*B\*\*/)
    assert.match(comment, /\| Cobertura de los tests unitarios \| 64,5 % \| mínimo 80 % \| ❌ \|/)
    assert.match(comment, /\| Líneas duplicadas \| 0 % \| máximo 3 % \| ✅ \|/)
  })

  it('lista los defectos nuevos del más grave al menos grave con link al HEAD del PR', () => {
    assert.match(comment, /### Defectos nuevos: 3/)
    const rows = comment.split('\n').filter((line) => /^\| (mayor|menor) /.test(line))
    assert.equal(rows.length, 3)
    assert.match(rows[0], /^\| mayor \| Bug \| /)
    assert.match(rows[2], /^\| menor \| Code smell \| /)
    assert.ok(
      rows[0].includes(
        `[\`backend/src/main.ts:41\`](https://github.com/uc/full_stack_testing/blob/${headSha}/backend/src/main.ts#L41)`,
      ),
    )
    // Una barra en el mensaje rompería la tabla
    assert.match(comment, /Extract this nested ternary \\\| operation\./)
    assert.match(comment, /contenedor temporal/)
  })

  it('si no hay defectos nuevos lo dice y no arma la tabla', () => {
    const clean = renderPrComment(
      buildPrReport({
        project,
        gate: QUALITY_GATE_PR,
        projectStatus: { projectStatus: { status: 'OK', conditions: [] } },
        measures: { component: { measures: [{ metric: 'new_lines', period: { value: '8' } }] } },
        issues: { total: 0, issues: [] },
        baseSha,
        headSha,
      }),
      links,
    )
    assert.match(clean, /✅ \*\*Quality gate aprobada\*\*/)
    assert.match(clean, /Sin defectos nuevos/)
    assert.doesNotMatch(clean, /\| Severidad \|/)
    assert.match(clean, /menos de 20 líneas nuevas/)
  })

  it('el texto sigue el estilo del repo: sin guiones largos ni medios ni punto y coma', () => {
    const text = comment.replace(/`[^`]*`/g, '').replace(/\([^)]*\)/g, '')
    assert.doesNotMatch(text, /[\u2013\u2014]/)
    assert.doesNotMatch(text, /;/)
  })
})
