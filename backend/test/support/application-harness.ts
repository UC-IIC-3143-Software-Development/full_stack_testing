import { CreateBook } from '../../src/books/application/create-book'
import { CreateLoan } from '../../src/loans/application/create-loan'
import { ListLoans } from '../../src/loans/application/list-loans'
import { RenewLoan } from '../../src/loans/application/renew-loan'
import { ReturnLoan } from '../../src/loans/application/return-loan'
import { FixedClock } from '../../src/shared/infrastructure/clock/fixed-clock'
import { InMemoryBookRepository } from '../fakes/in-memory-book.repository'
import { InMemoryLoanRepository } from '../fakes/in-memory-loan.repository'
import { InMemoryUnitOfWork } from '../fakes/in-memory-unit-of-work'
import { FIXED_NOW } from './test-data'

/**
 * Arma los casos de uso con fakes en memoria y reloj fijo. Sin mocks: los tests
 * verifican el estado final de los repositorios, no qué métodos se llamaron.
 */
export function createApplication() {
  const books = new InMemoryBookRepository()
  const loans = new InMemoryLoanRepository()
  const clock = new FixedClock(FIXED_NOW)
  const unitOfWork = new InMemoryUnitOfWork([books, loans])
  return {
    books,
    loans,
    clock,
    createBook: new CreateBook(books, clock),
    createLoan: new CreateLoan(books, loans, unitOfWork, clock),
    listLoans: new ListLoans(loans, clock),
    returnLoan: new ReturnLoan(books, loans, unitOfWork, clock),
    renewLoan: new RenewLoan(loans, unitOfWork, clock),
  }
}
