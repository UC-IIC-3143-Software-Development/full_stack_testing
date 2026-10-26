import { DuplicateLoanError, LoanLimitReachedError } from './loan.errors'
import type { Email } from './email'
import type { Loan } from './loan'

export const MAX_UNRETURNED_LOANS = 3

/**
 * Política de préstamos. Recibe los préstamos NO devueltos de la persona
 * (activos o vencidos) y decide si puede pedir el libro `bookId`.
 *
 * Orden de las reglas: primero LOAN-R4 (mensaje más específico) y después LOAN-R2.
 */
export function assertCanBorrow(
  borrowerEmail: Email,
  unreturnedLoans: readonly Loan[],
  bookId: string,
): void {
  const pending = unreturnedLoans.filter((loan) => !loan.isReturned)
  if (pending.some((loan) => loan.bookId === bookId)) {
    throw new DuplicateLoanError(borrowerEmail.value)
  }
  if (pending.length >= MAX_UNRETURNED_LOANS) {
    throw new LoanLimitReachedError(borrowerEmail.value, MAX_UNRETURNED_LOANS)
  }
}
