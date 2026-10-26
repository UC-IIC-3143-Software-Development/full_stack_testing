import { resolve } from 'node:path'

/** Configuración leída una sola vez desde variables de entorno (ver specs/architecture.md). */
export interface AppConfig {
  port: number
  databaseUrl: string
  clockFixedNow: string | undefined
  openApiPath: string
  runMigrations: boolean
}

export const APP_CONFIG = Symbol('AppConfig')

export const DEFAULT_DATABASE_URL = 'postgres://biblioteca:biblioteca@localhost:5432/biblioteca'

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3001)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT inválido: ${env.PORT}`)
  }
  return {
    port,
    databaseUrl: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    clockFixedNow: env.CLOCK_FIXED_NOW || undefined,
    // El contrato vive fuera de backend/. En desarrollo se lee desde ../specs y
    // en la imagen Docker desde la copia que indica OPENAPI_PATH.
    openApiPath: env.OPENAPI_PATH ?? resolve(process.cwd(), '..', 'specs', 'api', 'openapi.yaml'),
    runMigrations: env.DB_RUN_MIGRATIONS !== 'false',
  }
}
