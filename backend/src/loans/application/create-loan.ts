import { randomUUID } from 'node:crypto'
import type { BookRepository } from '../../books/application/book.repository'
import { BookNotFoundError, NoCopiesAvailableError } from '../../books/domain/book.errors'
import type { Clock } from '../../shared/application/clock'
import type { UnitOfWork } from '../../shared/application/unit-of-work'
import { Email } from '../domain/email'
import { Loan } from '../domain/loan'
import { assertCanBorrow } from '../domain/loan-policy'
import type { LoanRepository } from './loan.repository'
import { toLoanDetails, type LoanDetails } from './loan-details'

export interface CreateLoanCommand {
  bookId: string
  borrowerEmail: string
}

/** Caso de uso: registrar un préstamo (SPEC-LIB-02). */
export class CreateLoan {
  constructor(
    private readonly books: BookRepository,
    private readonly loans: LoanRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateLoanCommand): Promise<LoanDetails> {
    const borrower = Email.create(command.borrowerEmail) // LOAN-R7
    const now = this.clock.now()

    // Todo dentro de una transacción: si algo falla, no queda una copia descontada sin préstamo.
    const loan = await this.unitOfWork.run(async () => {
      await this.loans.lockBorrower(borrower) // LOAN-R2 ante solicitudes simultáneas

      const book = await this.books.findById(command.bookId)
      if (!book) {
        throw new BookNotFoundError(command.bookId) // LOAN-R7
      }

      const unreturned = await this.loans.findUnreturnedByBorrower(borrower)
      assertCanBorrow(borrower, unreturned, book.id) // LOAN-R4 y LOAN-R2

      const lentBook = book.lendCopy() // LOAN-R1: la regla vive en el dominio
      if (!(await this.books.takeCopy(book.id))) {
        throw new NoCopiesAvailableError(book.id) // LOAN-R1: la base de datos la garantiza ante concurrencia
      }

      const newLoan = Loan.open({
        id: randomUUID(),
        bookId: lentBook.id,
        bookTitle: lentBook.title,
        borrowerEmail: borrower,
        now,
      })
      await this.loans.add(newLoan)
      return newLoan
    })

    return toLoanDetails(loan, now)
  }
}
