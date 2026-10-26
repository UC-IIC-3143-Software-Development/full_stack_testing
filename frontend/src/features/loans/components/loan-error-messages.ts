// UI-LOAN-4. Textos de la interfaz para los conflictos (409) al pedir un préstamo.

export const LOAN_CONFLICT_MESSAGES: Record<string, string> = {
  LOAN_LIMIT_REACHED: 'Alcanzaste el máximo de 3 préstamos activos',
  NO_COPIES_AVAILABLE: 'No quedan copias disponibles',
  DUPLICATE_LOAN: 'Ya tienes este libro prestado',
}

export const GENERIC_ERROR_MESSAGE = 'No pudimos completar la operación. Intenta de nuevo.'

export function loanConflictMessage(code: string | undefined): string {
  return (code && LOAN_CONFLICT_MESSAGES[code]) || GENERIC_ERROR_MESSAGE
}
