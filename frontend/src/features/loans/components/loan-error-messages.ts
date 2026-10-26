import type { ApiFailure } from '@/shared/api/problem'
import type { LoanAction } from '../hooks/useLoans'

// UI-LOAN-4. Textos de la interfaz para los conflictos (409) al pedir un préstamo.
export const LOAN_CONFLICT_MESSAGES: Record<string, string> = {
  LOAN_LIMIT_REACHED: 'Alcanzaste el máximo de 3 préstamos activos',
  NO_COPIES_AVAILABLE: 'No quedan copias disponibles',
  DUPLICATE_LOAN: 'Ya tienes este libro prestado',
}

// UI-RENEW-2. Textos de la interfaz para los conflictos (409) al renovar un préstamo.
export const RENEW_CONFLICT_MESSAGES: Record<string, string> = {
  RENEWAL_LIMIT_REACHED: 'Este préstamo ya fue renovado',
  LOAN_OVERDUE: 'No puedes renovar un préstamo vencido',
}

export const GENERIC_ERROR_MESSAGE = 'No pudimos completar la operación. Intenta de nuevo.'

export function loanConflictMessage(code: string | undefined): string {
  return (code && LOAN_CONFLICT_MESSAGES[code]) || GENERIC_ERROR_MESSAGE
}

/**
 * Mensaje para un error al devolver o renovar. Los 409 de UI-RENEW-2 tienen texto propio.
 * El resto muestra el detalle que entrega la API o el mensaje genérico.
 */
export function loanActionMessage(failure: ApiFailure, action: LoanAction): string {
  if (failure.kind !== 'problem') return GENERIC_ERROR_MESSAGE
  const { code, detail } = failure.problem
  const renewMessage = action === 'renew' ? RENEW_CONFLICT_MESSAGES[code] : undefined
  return renewMessage ?? detail ?? GENERIC_ERROR_MESSAGE
}
