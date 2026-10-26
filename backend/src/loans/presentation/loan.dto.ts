import type { LoanDetails } from '../application/loan-details'
import type { LoanStatus } from '../domain/loan'

/** Tipos HTTP (schemas NewLoan y Loan). La validación la hace el middleware de OpenAPI. */
export interface NewLoanRequest {
  bookId: string
  borrowerEmail: string
}

export interface LoanResponse {
  id: string
  bookId: string
  bookTitle: string
  borrowerEmail: string
  loanedAt: string
  dueAt: string
  returnedAt: string | null
  status: LoanStatus
}

export function toLoanResponse(loan: LoanDetails): LoanResponse {
  return {
    id: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.bookTitle,
    borrowerEmail: loan.borrowerEmail,
    loanedAt: loan.loanedAt.toISOString(),
    dueAt: loan.dueAt.toISOString(),
    returnedAt: loan.returnedAt ? loan.returnedAt.toISOString() : null,
    status: loan.status,
  }
}
