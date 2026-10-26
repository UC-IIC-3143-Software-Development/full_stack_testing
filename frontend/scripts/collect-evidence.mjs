// Lee reports/playwright.json y escribe evidence/manifest.json con el formato de
// specs/architecture.md. Copia el video de cada flujo a evidence/videos/<FLOW-ID>.webm.
// El pipeline usa el manifiesto para comentar el PR (y convierte los videos a GIF con ffmpeg).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const REPORT = 'reports/playwright.json'
const EVIDENCE = 'evidence'

if (!existsSync(REPORT)) {
  console.warn(`No existe ${REPORT}: no hay evidencia que recolectar.`)
  process.exit(0)
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'))
const screenshotsDir = path.join(EVIDENCE, 'screenshots')
const screenshots = existsSync(screenshotsDir) ? readdirSync(screenshotsDir) : []
const items = []

function statusOf(test) {
  if (test.status === 'flaky') return 'flaky'
  if (test.status === 'skipped') return 'skipped'
  return test.results.at(-1)?.status === 'passed' ? 'passed' : 'failed'
}

function collect(spec, test) {
  if (test.projectName !== 'flows') return
  const tags = [...(spec.tags ?? []), ...(test.tags ?? [])].map((t) => t.replace(/^@/, ''))
  const id = tags.find((t) => t.startsWith('FLOW-'))
  if (!id || items.some((item) => item.id === id)) return

  const item = { id, title: spec.title, status: statusOf(test), screenshots: [] }
  const video = test.results.at(-1)?.attachments.find((a) => a.name === 'video' && a.path)
  if (video && existsSync(video.path)) {
    mkdirSync(path.join(EVIDENCE, 'videos'), { recursive: true })
    copyFileSync(video.path, path.join(EVIDENCE, 'videos', `${id}.webm`))
    item.video = `videos/${id}.webm`
  }
  item.screenshots = screenshots
    .filter((file) => file.startsWith(`${id}-`))
    .sort((a, b) => Number(a.split('-')[3]) - Number(b.split('-')[3]))
    .map((file) => `screenshots/${file}`)
  items.push(item)
}

function walk(suite) {
  for (const child of suite.suites ?? []) walk(child)
  for (const spec of suite.specs ?? []) for (const test of spec.tests) collect(spec, test)
}
report.suites.forEach(walk)

items.sort((a, b) => a.id.localeCompare(b.id))
mkdirSync(EVIDENCE, { recursive: true })
const manifest = { target: process.env.E2E_TARGET ?? 'mock', items }
writeFileSync(path.join(EVIDENCE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Evidencia: ${items.length} flujos en ${EVIDENCE}/manifest.json`)
