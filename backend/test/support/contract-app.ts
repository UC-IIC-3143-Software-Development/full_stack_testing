import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { FIXED_NOW } from './test-data'

export interface RunningApp {
  app: NestExpressApplication
  http: App
  dataSource: DataSource
}

/**
 * Levanta la app completa: AppModule real, sin overrides ni mocks, con la misma
 * configuración HTTP de main.ts. Solo cambian las variables de entorno:
 * DATABASE_URL apunta al PostgreSQL de Testcontainers y el reloj queda fijo.
 */
export async function startApp(): Promise<RunningApp> {
  process.env.CLOCK_FIXED_NOW = FIXED_NOW
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] }),
  )
  await app.init()
  return { app, http: app.getHttpServer() as App, dataSource: app.get(DataSource) }
}
