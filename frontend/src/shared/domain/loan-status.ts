// LOAN-R6 y UI-LOAN-2. El estado lo calcula el backend (LOAN-R6). El frontend solo decide
// cómo mostrarlo: etiqueta en español y token de color.

export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'RETURNED'

export interface StatusPresentation {
  label: string
  /** Token de diseño definido en app/globals.css */
  colorToken: '--color-info' | '--color-danger' | '--color-muted'
}

const PRESENTATION: Record<LoanStatus, StatusPresentation> = {
  ACTIVE: { label: 'Activo', colorToken: '--color-info' },
  OVERDUE: { label: 'Vencido', colorToken: '--color-danger' },
  RETURNED: { label: 'Devuelto', colorToken: '--color-muted' },
}

/** Etiqueta y color de cada estado de LOAN-R6 (UI-LOAN-2). */
export function presentLoanStatus(status: LoanStatus): StatusPresentation {
  return PRESENTATION[status]
}
