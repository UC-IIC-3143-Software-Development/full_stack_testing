import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { loadConfig } from '../shared/infrastructure/config/app-config'
import { createDataSource } from './data-source'

/** npm run migration:run (requiere npm run build). Aplica las migraciones pendientes. */
async function main(): Promise<void> {
  const { databaseUrl } = loadConfig()
  const dataSource = await createDataSource({ databaseUrl }).initialize()
  try {
    const applied = await dataSource.runMigrations()
    const logger = new Logger('Migrations')
    logger.log(`Migraciones aplicadas: ${applied.length}`)
    for (const migration of applied) {
      logger.log(`  ${migration.name}`)
    }
  } finally {
    await dataSource.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
