import type { LoanRepository } from '../../src/loans/application/loan.repository'
import type { Email } from '../../src/loans/domain/email'
import type { Loan } from '../../src/loans/domain/loan'
import { DuplicateLoanError } from '../../src/loans/domain/loan.errors'
import type { Snapshottable } from './in-memory-unit-of-work'

/** Fake en memoria del repositorio de préstamos. Imita el índice único parcial de LOAN-R4. */
export class InMemoryLoanRepository implements LoanRepository, Snapshottable {
  private loans = new Map<string, Loan>()

  async lockBorrower(): Promise<void> {
    // InMemoryUnitOfWork ya ejecuta las unidades de trabajo de a una.
  }

  async add(loan: Loan): Promise<void> {
    const duplicated = this.all().some(
      (existing) =>
        !existing.isReturned &&
        existing.bookId === loan.bookId &&
        existing.borrowerEmail.equals(loan.borrowerEmail),
    )
    if (duplicated) {
      throw new DuplicateLoanError(loan.borrowerEmail.value)
    }
    this.loans.set(loan.id, loan)
  }

  async findById(id: string): Promise<Loan | null> {
    return this.loans.get(id) ?? null
  }

  async findByBorrower(borrowerEmail: Email): Promise<Loan[]> {
    return this.all()
      .filter((loan) => loan.borrowerEmail.equals(borrowerEmail))
      .sort(newestFirst)
  }

  async findUnreturnedByBorrower(borrowerEmail: Email): Promise<Loan[]> {
    return (await this.findByBorrower(borrowerEmail)).filter((loan) => !loan.isReturned)
  }

  async markReturned(loan: Loan): Promise<boolean> {
    const current = this.loans.get(loan.id)
    if (!current || current.isReturned) return false
    this.loans.set(loan.id, loan)
    return true
  }

  /** Igual que el UPDATE condicional de PostgreSQL: solo si no se devolvió ni se renovó antes. */
  async markRenewed(loan: Loan): Promise<boolean> {
    const current = this.loans.get(loan.id)
    if (!current || current.isReturned || current.renewalCount !== loan.renewalCount - 1) {
      return false
    }
    this.loans.set(loan.id, loan)
    return true
  }

  snapshot(): Map<string, Loan> {
    return new Map(this.loans)
  }

  restore(snapshot: unknown): void {
    this.loans = new Map(snapshot as Map<string, Loan>)
  }

  private all(): Loan[] {
    return [...this.loans.values()]
  }
}

/** Igual que ORDER BY loaned_at DESC, id en PostgreSQL. */
function newestFirst(a: Loan, b: Loan): number {
  const byDate = b.loanedAt.getTime() - a.loanedAt.getTime()
  if (byDate !== 0) return byDate
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}
