import type { Loan, LoanStatus } from '../domain/loan'

/** Lo que devuelven los casos de uso de préstamos: el préstamo y su estado calculado (LOAN-R6). */
export interface LoanDetails {
  id: string
  bookId: string
  bookTitle: string
  borrowerEmail: string
  loanedAt: Date
  dueAt: Date
  returnedAt: Date | null
  status: LoanStatus
  renewalCount: number
}

export function toLoanDetails(loan: Loan, now: Date): LoanDetails {
  return {
    id: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.bookTitle,
    borrowerEmail: loan.borrowerEmail.value,
    loanedAt: loan.loanedAt,
    dueAt: loan.dueAt,
    returnedAt: loan.returnedAt,
    status: loan.statusAt(now),
    renewalCount: loan.renewalCount,
  }
}
