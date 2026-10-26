// Corre Playwright dentro de la imagen oficial (Linux), la misma que usa el job de CI.
// Las imágenes de referencia de la regresión visual solo son comparables si se generan
// con el mismo sistema operativo, las mismas fuentes y el mismo navegador.
//   npm run test:visual:docker               regenera las líneas base (--update-snapshots)
//   npm run test:visual:docker -- --check    compara contra las líneas base sin cambiarlas
//   npm run test:visual:docker -- --e2e      corre test:e2e completo en Linux
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const IMAGE = 'mcr.microsoft.com/playwright:v1.64.1-noble'
const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const args = process.argv.slice(2)

let command = 'npx playwright test --project=visual --update-snapshots'
if (args.includes('--check')) command = 'npx playwright test --project=visual'
if (args.includes('--e2e')) command = 'npm run test:e2e'

// docker se busca en el PATH a propósito: su ruta cambia entre macOS, Linux y Windows.
// SonarJS lo marca como punto a revisar (security hotspot): aquí es seguro, porque es un
// script para tu máquina y el PATH es el tuyo.
const docker = spawnSync(
  'docker', // eslint-disable-line sonarjs/no-os-command-from-path
  [
    'run',
    '--rm',
    '--ipc=host',
    '-e',
    'CI=1',
    '-v',
    `${repoRoot}:/work`,
    // Volúmenes anónimos: los binarios nativos de macOS no sirven en Linux y el build
    // de Linux no debe pisar el .next local. Se borran solos al terminar (--rm).
    '-v',
    '/work/frontend/node_modules',
    '-v',
    '/work/frontend/.next',
    '-w',
    '/work/frontend',
    IMAGE,
    'bash',
    '-lc',
    `npm ci --no-audit --no-fund && ${command}`,
  ],
  { stdio: 'inherit' },
)
process.exit(docker.status ?? 1)
