// Normaliza los errores RFC 9457 (application/problem+json) que define el contrato.
import type { Problem, RenewalProblem } from './types'

/** Cualquier error del contrato: Problem o el 409 propio de renewLoan (RenewalProblem). */
export type AnyProblem = Problem | RenewalProblem

export type ApiFailure =
  | {
      kind: 'problem'
      problem: AnyProblem
    }
  | {
      kind: 'network'
      message: string
    }

function isProblem(value: unknown): value is AnyProblem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'code' in value &&
    typeof (value as AnyProblem).code === 'string'
  )
}

export function toApiFailure(error: unknown): ApiFailure {
  if (isProblem(error)) return { kind: 'problem', problem: error }
  return { kind: 'network', message: error instanceof Error ? error.message : String(error) }
}

/** Errores por campo de un 400, como mapa campo a mensaje. */
export function fieldErrorsOf(failure: ApiFailure | null): Record<string, string> {
  if (failure?.kind !== 'problem' || !('errors' in failure.problem)) return {}
  return Object.fromEntries((failure.problem.errors ?? []).map((e) => [e.field, e.message]))
}
