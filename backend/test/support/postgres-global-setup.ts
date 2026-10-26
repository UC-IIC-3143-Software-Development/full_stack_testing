import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'

/** Imagen igual a la de producción y a la del pipeline. */
export const POSTGRES_IMAGE = 'postgres:17-alpine'

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined
}

/**
 * Un contenedor PostgreSQL por corrida (no por test): arrancarlo toma unos segundos.
 * Testcontainers elige un puerto libre al azar, así que no choca con otra base de datos local.
 * Los workers de Jest heredan DATABASE_URL porque se crean después de este setup.
 */
export default async function globalSetup(): Promise<void> {
  // Alternativa: usar un PostgreSQL ya levantado (un service container de CI o uno local
  // si Docker no está disponible). La base de datos debe ser desechable: los tests la vacían.
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    return
  }
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('biblioteca')
    .withUsername('biblioteca')
    .withPassword('biblioteca')
    .start()
  process.env.DATABASE_URL = container.getConnectionUri()
  globalThis.__POSTGRES_CONTAINER__ = container
}
