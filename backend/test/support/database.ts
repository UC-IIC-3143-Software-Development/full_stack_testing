import type { DataSource } from 'typeorm'
import { createDataSource } from '../../src/database/data-source'

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL: este test debe correr con el globalSetup de Testcontainers',
    )
  }
  return url
}

/** Abre una conexión y aplica las migraciones reales (las mismas que producción). */
export async function openMigratedDataSource(): Promise<DataSource> {
  const dataSource = await createDataSource({ databaseUrl: databaseUrl() }).initialize()
  await dataSource.runMigrations()
  return dataSource
}

/** Deja las tablas vacías para que cada test prepare su propio estado (P4.5). */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE TABLE loans, books')
}

/**
 * Barrera para tests de concurrencia deterministas: una transacción aparte toma las filas
 * de books con FOR UPDATE. Las solicitudes que intenten modificarlas quedan esperando
 * hasta `release()`, así todas compiten de verdad por el mismo recurso.
 */
export async function holdBookRows(
  dataSource: DataSource,
  bookIds: string[],
): Promise<{ release(): Promise<void> }> {
  const runner = dataSource.createQueryRunner()
  await runner.connect()
  await runner.startTransaction()
  await runner.query('SELECT id FROM books WHERE id = ANY($1) FOR UPDATE', [bookIds])
  return {
    async release() {
      await runner.commitTransaction()
      await runner.release()
    },
  }
}

/**
 * Espera a que `count` sesiones estén bloqueadas esperando un lock. No usa sleep:
 * consulta pg_stat_activity hasta que se cumple la condición o vence el plazo.
 */
export async function waitForBlockedSessions(
  dataSource: DataSource,
  count: number,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const [{ blocked }]: { blocked: number }[] = await dataSource.query(
      `SELECT count(*)::int AS blocked FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    )
    if (blocked >= count) return
    if (Date.now() > deadline) {
      throw new Error(`Solo ${blocked} de ${count} sesiones llegaron a la barrera`)
    }
  }
}
