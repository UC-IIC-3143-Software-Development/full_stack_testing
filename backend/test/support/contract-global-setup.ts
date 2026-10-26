import { rmSync } from 'node:fs'
import postgresGlobalSetup from './postgres-global-setup'
import { HITS_FILE } from './openapi-contract'

/** Igual que en integración, más limpiar el registro de cobertura del contrato. */
export default async function globalSetup(): Promise<void> {
  rmSync(HITS_FILE, { force: true })
  await postgresGlobalSetup()
}
