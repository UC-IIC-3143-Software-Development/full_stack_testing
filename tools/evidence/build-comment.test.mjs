// Tests del comentario de evidencia con artefactos de ejemplo (tools/__fixtures__/evidence).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  MARKER,
  buildComment,
  loadArtifacts,
  loadOperations,
  parseJunit,
  summarizeSemgrep,
  summarizeTrivy,
  summarizeZap,
} from './build-comment.mjs'
import { convertToGif, hasFfmpeg } from './videos-to-gif.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '..', '__fixtures__', 'evidence')
const openapi = join(here, '..', '..', 'specs', 'api', 'openapi.yaml')
const needs = JSON.parse(readFileSync(join(fixtures, 'needs.json'), 'utf8'))
const base = 'https://raw.githubusercontent.com/org/repo/evidence/pr-7/99'

describe('build-comment: resúmenes por herramienta', () => {
  it('cuenta vulnerabilidades de Trivy por severidad', () => {
    const report = JSON.parse(
      readFileSync(join(fixtures, 'trivy-imagenes/trivy-image-backend.json'), 'utf8'),
    )
    assert.deepEqual(summarizeTrivy(report), {
      counts: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 1 },
      secrets: 0,
      misconfigs: 0,
    })
  })

  it('cuenta alertas de ZAP por riesgo', () => {
    const report = JSON.parse(readFileSync(join(fixtures, 'zap/zap-frontend.json'), 'utf8'))
    assert.deepEqual(summarizeZap(report).counts, { High: 0, Medium: 1, Low: 0, Informational: 1 })
  })

  it('normaliza las severidades nuevas de Semgrep (HIGH, MEDIUM, LOW)', () => {
    const report = { results: [{ extra: { severity: 'HIGH' } }, { extra: { severity: 'LOW' } }] }
    assert.deepEqual(summarizeSemgrep(report).counts, { ERROR: 1, WARNING: 0, INFO: 1 })
  })

  it('lee casos y fallas de un JUnit de Schemathesis', () => {
    const xml =
      '<testsuite><testcase name="GET /api/books" /><testcase name="POST /api/loans">' +
      '<failure message="Response violates schema &amp; more">x</failure></testcase></testsuite>'
    assert.deepEqual(parseJunit(xml), {
      total: 2,
      failed: 1,
      cases: [
        { name: 'GET /api/books', failed: false, message: '' },
        { name: 'POST /api/loans', failed: true, message: 'Response violates schema & more' },
      ],
    })
  })

  it('lee las 7 operaciones del contrato real', () => {
    assert.deepEqual(
      loadOperations(openapi).map((op) => op.operationId),
      ['getHealth', 'listBooks', 'createBook', 'getBook', 'listLoans', 'createLoan', 'returnLoan'],
    )
  })
})

describe('build-comment: comentario completo', () => {
  const comment = buildComment({
    artifacts: loadArtifacts(fixtures),
    needs,
    operations: loadOperations(openapi),
    baseUrl: base,
    runUrl: 'https://github.com/org/repo/actions/runs/99',
    prNumber: '7',
    sha: 'abcdef123456',
    example: true,
  })

  it('empieza con el marcador para actualizar el mismo comentario', () => {
    assert.equal(comment.startsWith(MARKER), true)
  })

  it('marca la etapa 9 como fallida cuando falla el job dast', () => {
    assert.match(comment, /\*\*9 · Sistema y DAST\*\* .* ❌ \|$/m)
    assert.match(comment, /\*\*❌ Hay etapas con fallas\*\*/)
  })

  it('muestra el GIF y las miniaturas desde la rama evidence', () => {
    assert.match(comment, new RegExp(`<img src="${base}/evidencia-mock/videos/FLOW-PRE-01.gif"`))
    assert.match(
      comment,
      /evidencia-fullstack\/screenshots\/FLOW-CAT-01-1-catalogo.png" width="180"/,
    )
  })

  it('cruza contrato y smoke por operationId', () => {
    assert.match(
      comment,
      /\| `createLoan` \| `POST \/api\/loans` \| ✅ 201 · 400 · 404 · 409 \| ✅ 201 · 404/,
    )
  })

  it('no usa guiones largos ni punto y coma en el texto', () => {
    const text = comment.replace(/<[^>]+>/g, '')
    assert.doesNotMatch(text, /[–—;]/)
  })
})

describe('build-comment: artefactos faltantes', () => {
  it('genera el comentario con secciones "no disponible" si no hay artefactos', () => {
    const empty = mkdtempSync(join(tmpdir(), 'evidencia-'))
    const comment = buildComment({ artifacts: loadArtifacts(empty), needs: {}, operations: [] })
    assert.match(comment, /No disponible: la etapa no corrió/)
    assert.match(comment, /\| Trivy fs \| SCA, secretos e IaC \| no disponible \|/)
  })

  it('enlaza el video al artefacto cuando el GIF no existe', () => {
    const comment = buildComment({
      artifacts: loadArtifacts(fixtures),
      needs,
      operations: [],
      baseUrl: base,
      runUrl: 'https://run',
      example: false,
    })
    assert.match(
      comment,
      /🎬 Video disponible en los \[artefactos del run\]\(https:\/\/run#artifacts\)/,
    )
  })

  it('la CLI escribe el archivo de salida', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'comentario-')), 'comment.md')
    const run = spawnSync(
      process.execPath,
      [join(here, 'build-comment.mjs'), '--artifacts', fixtures, '--out', out],
      { encoding: 'utf8', env: { ...process.env, NEEDS_JSON: JSON.stringify(needs) } },
    )
    assert.equal(run.status, 0, run.stderr)
    assert.match(readFileSync(out, 'utf8'), /Evidencia de CI/)
  })
})

describe('videos-to-gif', () => {
  it(
    'convierte un webm en un GIF de 640 px a 8 fps',
    { skip: !hasFfmpeg() && 'ffmpeg no está instalado' },
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'video-'))
      mkdirSync(join(dir, 'videos'))
      const video = join(dir, 'videos', 'FLOW-X-01.webm')
      const make = spawnSync('ffmpeg', [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=2:size=1280x720:rate=25',
        '-c:v',
        'libvpx-vp9',
        video,
      ])
      if (make.status !== 0) return
      const gif = convertToGif(video)
      const probe = spawnSync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=width,r_frame_rate',
        '-of',
        'csv=p=0',
        gif,
      ])
      assert.equal(probe.stdout.toString().trim(), '640,8/1')
    },
  )
})
