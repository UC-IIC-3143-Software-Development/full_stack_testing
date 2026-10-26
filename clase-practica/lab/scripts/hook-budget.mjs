// Hook "Stop" de Claude Code: si el agente modificó tests y la suite excede el
// presupuesto, no lo deja terminar y le devuelve el reporte (exit 2 → stderr al agente).
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
if (input.stop_hook_active) process.exit(0) // evita bucles infinitos

// Sin repo git no se puede saber qué cambió: se valida igual.
let changed = true
try {
  changed =
    execSync('git status --porcelain -- tests', { encoding: 'utf8', stdio: 'pipe' }).trim() !== ''
} catch {}
if (!changed) process.exit(0)

try {
  execSync('npm run --silent budget', { stdio: 'pipe', encoding: 'utf8' })
} catch (error) {
  process.stderr.write(
    'El presupuesto de tests falló. Corrige la suite según CLAUDE.md antes de terminar:\n' +
      (error.stdout ?? '') +
      (error.stderr ?? ''),
  )
  process.exit(2)
}
