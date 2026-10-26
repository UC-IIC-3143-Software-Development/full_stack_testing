import type { Clock } from '../../shared/application/clock'
import { Email } from '../domain/email'
import type { LoanRepository } from './loan.repository'
import { toLoanDetails, type LoanDetails } from './loan-details'

/** Caso de uso: listar los préstamos de una persona con su estado calculado (LOAN-R6). */
export class ListLoans {
  constructor(
    private readonly loans: LoanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(borrowerEmail: string): Promise<LoanDetails[]> {
    const borrower = Email.create(borrowerEmail) // LOAN-R7: se busca por el correo normalizado
    const loans = await this.loans.findByBorrower(borrower)
    const now = this.clock.now()
    return loans.map((loan) => toLoanDetails(loan, now))
  }
}
