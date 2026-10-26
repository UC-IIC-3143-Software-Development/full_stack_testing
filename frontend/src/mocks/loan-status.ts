// Versión mínima de LOAN-R6 para el mock server. La regla real (y sus tests de valor límite)
// vive en el dominio del backend: aquí solo se necesita para devolver datos realistas.
import type { LoanStatus } from '@/shared/domain/loan-status'

interface LoanDates {
  dueAt: string
  returnedAt: string | null
}

export function computeLoanStatus(loan: LoanDates, now: Date): LoanStatus {
  if (loan.returnedAt !== null) return 'RETURNED'
  return now.getTime() > new Date(loan.dueAt).getTime() ? 'OVERDUE' : 'ACTIVE'
}
