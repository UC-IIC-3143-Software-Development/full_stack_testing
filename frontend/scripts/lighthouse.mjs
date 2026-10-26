// Lighthouse CI: accesibilidad, buenas prácticas, rendimiento y SEO de / y /prestamos.
//   E2E_BASE_URL=http://localhost:3000 npm run test:lighthouse   contra un servidor ya levantado
//   npm run test:lighthouse                                       compila con MSW y lo levanta solo
// Necesita Chrome o Chromium instalado (en GitHub Actions ya viene en ubuntu-latest).
import { spawnSync } from 'node:child_process'

const port = process.env.E2E_PORT ?? '3000'
const baseUrl = (process.env.E2E_BASE_URL ?? `http://localhost:${port}`).replace(/\/$/, '')
const args = ['autorun', `--collect.url=${baseUrl}/`, `--collect.url=${baseUrl}/prestamos`]

if (!process.env.E2E_BASE_URL) {
  // Sin shell: true (Semgrep lo marca como riesgo de inyección). npm_execpath apunta al npm en uso.
  const npmCli = process.env.npm_execpath
  const build = npmCli
    ? spawnSync(process.execPath, [npmCli, 'run', 'build:mock'], { stdio: 'inherit' })
    : spawnSync('npm', ['run', 'build:mock'], { stdio: 'inherit' })
  if (build.status !== 0) process.exit(build.status ?? 1)
  args.push(`--collect.startServerCommand=npm run start`, '--collect.startServerReadyPattern=Ready')
}

const lhci = spawnSync(process.execPath, ['node_modules/@lhci/cli/src/cli.js', ...args], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port },
})
process.exit(lhci.status ?? 1)
