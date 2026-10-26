// Drift check del contrato (P2): regenera los tipos desde specs/api/openapi.yaml en un
// archivo temporal y falla si difieren de src/shared/api/schema.d.ts (que está commiteado).
// Si alguien cambia el contrato y no corre `npm run api:generate`, CI lo detecta aquí.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const committed = 'src/shared/api/schema.d.ts'
const dir = mkdtempSync(join(tmpdir(), 'api-check-'))
const fresh = join(dir, 'schema.d.ts')

try {
  execFileSync(
    process.execPath,
    ['node_modules/openapi-typescript/bin/cli.js', '../specs/api/openapi.yaml', '--output', fresh],
    { stdio: 'pipe' },
  )
  if (readFileSync(fresh, 'utf8') !== readFileSync(committed, 'utf8')) {
    console.error(`✖ ${committed} no coincide con specs/api/openapi.yaml.`)
    console.error('  Corre `npm run api:generate` y commitea el resultado.')
    process.exit(1)
  }
  console.log(`✔ ${committed} está sincronizado con el contrato OpenAPI.`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
