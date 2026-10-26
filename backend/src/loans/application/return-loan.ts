import type { BookRepository } from '../../books/application/book.repository'
import type { Clock } from '../../shared/application/clock'
import type { UnitOfWork } from '../../shared/application/unit-of-work'
import { AlreadyReturnedError, LoanNotFoundError } from '../domain/loan.errors'
import type { LoanRepository } from './loan.repository'
import { toLoanDetails, type LoanDetails } from './loan-details'

/** Caso de uso: registrar la devolución de un préstamo (LOAN-R5). */
export class ReturnLoan {
  constructor(
    private readonly books: BookRepository,
    private readonly loans: LoanRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(loanId: string): Promise<LoanDetails> {
    const now = this.clock.now()

    const returned = await this.unitOfWork.run(async () => {
      const loan = await this.loans.findById(loanId)
      if (!loan) {
        throw new LoanNotFoundError(loanId)
      }
      const returnedLoan = loan.markReturned(now) // LOAN-R5 en el dominio
      if (!(await this.loans.markReturned(returnedLoan))) {
        throw new AlreadyReturnedError(loanId) // otra solicitud lo devolvió primero
      }
      await this.books.releaseCopy(loan.bookId)
      // Se responde lo guardado, no lo leído al inicio: una renovación concurrente pudo
      // confirmar dueAt y renewalCount nuevos antes del UPDATE condicional.
      return (await this.loans.findById(loanId)) ?? returnedLoan
    })

    return toLoanDetails(returned, now)
  }
}
