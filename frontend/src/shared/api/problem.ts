// Normaliza los errores RFC 9457 (application/problem+json) que define el contrato.
import type { Problem } from './types'

export type ApiFailure =
  | {
      kind: 'problem'
      problem: Problem
    }
  | {
      kind: 'network'
      message: string
    }

function isProblem(value: unknown): value is Problem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'code' in value &&
    typeof (value as Problem).code === 'string'
  )
}

export function toApiFailure(error: unknown): ApiFailure {
  if (isProblem(error)) return { kind: 'problem', problem: error }
  return { kind: 'network', message: error instanceof Error ? error.message : String(error) }
}

/** Errores por campo de un 400, como mapa campo a mensaje. */
export function fieldErrorsOf(failure: ApiFailure | null): Record<string, string> {
  if (failure?.kind !== 'problem') return {}
  return Object.fromEntries((failure.problem.errors ?? []).map((e) => [e.field, e.message]))
}
