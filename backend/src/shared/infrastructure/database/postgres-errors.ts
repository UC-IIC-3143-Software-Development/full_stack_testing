import { QueryFailedError } from 'typeorm'

const UNIQUE_VIOLATION = '23505'

/** Campos que el driver pg agrega a sus errores. */
interface PostgresDriverError {
  code?: string
  constraint?: string
}

/** true si el error es una violación del índice único `constraint` (código 23505 de PostgreSQL). */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false
  }
  const driverError = error.driverError as PostgresDriverError
  return driverError.code === UNIQUE_VIOLATION && driverError.constraint === constraint
}
