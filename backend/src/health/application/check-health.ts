import type { HealthStatus } from '../domain/health-status'
import type { DatabaseProbe } from './database-probe'

/** Caso de uso: la API está sana si la base de datos responde. Si no, el error se propaga. */
export class CheckHealth {
  constructor(private readonly database: DatabaseProbe) {}

  async execute(): Promise<{ status: HealthStatus }> {
    await this.database.ping()
    return { status: 'ok' }
  }
}
