// Ejecuta Playwright y, pase lo que pase, arma evidence/manifest.json para el PR.
//   node scripts/run-e2e.mjs            todos los proyectos contra Next + MSW
//   node scripts/run-e2e.mjs --smoke    escenarios @smoke (contra E2E_BASE_URL si existe)
// Cualquier otro argumento se pasa tal cual a `playwright test`.
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'

const args = process.argv.slice(2)
const smoke = args.includes('--smoke')
const passthrough = args.filter((arg) => arg !== '--smoke')
const env = { ...process.env }
env.E2E_TARGET ??= env.E2E_BASE_URL ? 'fullstack' : 'mock'

const run = (script, scriptArgs) =>
  spawnSync(process.execPath, [script, ...scriptArgs], { stdio: 'inherit', env }).status ?? 1

rmSync('evidence', { recursive: true, force: true })

if (run('node_modules/playwright-bdd/dist/cli/index.js', []) !== 0) process.exit(1)

const playwrightArgs = [
  'test',
  ...(smoke ? ['--project=flows', '--grep', '@smoke'] : []),
  ...passthrough,
]
const status = run('node_modules/@playwright/test/cli.js', playwrightArgs)

run('scripts/collect-evidence.mjs', [])
process.exit(status)
