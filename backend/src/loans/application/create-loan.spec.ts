import { BookNotFoundError, NoCopiesAvailableError } from '../../books/domain/book.errors'
import { createApplication } from '../../../test/support/application-harness'
import { rejectionOf } from '../../../test/support/errors'
import { aBook, CATALOG, nextUuid } from '../../../test/support/test-data'
import { Email } from '../domain/email'
import { DuplicateLoanError, LoanLimitReachedError } from '../domain/loan.errors'

async function appWithBooks() {
  const app = createApplication()
  const cienAnos = aBook(CATALOG.cienAnos, 3)
  const casaEspiritus = aBook(CATALOG.casaEspiritus, 1)
  const books = [cienAnos, casaEspiritus, aBook(CATALOG.ficciones, 2), aBook(CATALOG.desolacion)]
  for (const book of books) await app.books.add(book)
  return { app, cienAnos, casaEspiritus, books }
}

describe('CreateLoan', () => {
  it('[LOAN-R1] presta un libro disponible y descuenta una copia', async () => {
    const { app, cienAnos } = await appWithBooks()

    const loan = await app.createLoan.execute({ bookId: cienAnos.id, borrowerEmail: 'Ana@UC.cl' })

    expect(loan).toMatchObject({
      bookTitle: 'Cien años de soledad',
      borrowerEmail: 'ana@uc.cl',
      loanedAt: new Date('2026-03-02T12:00:00.000Z'),
      dueAt: new Date('2026-03-16T12:00:00.000Z'),
      returnedAt: null,
      status: 'ACTIVE',
    })
    expect((await app.books.findById(cienAnos.id))?.availableCopies).toBe(2)
  })

  it('[LOAN-R1] sin copias disponibles no registra el préstamo', async () => {
    const { app, casaEspiritus } = await appWithBooks()
    await app.createLoan.execute({ bookId: casaEspiritus.id, borrowerEmail: 'ana@uc.cl' })

    const error = await rejectionOf(
      app.createLoan.execute({ bookId: casaEspiritus.id, borrowerEmail: 'beto@uc.cl' }),
    )

    expect(error).toBeInstanceOf(NoCopiesAvailableError)
    expect(await app.loans.findByBorrower(Email.create('beto@uc.cl'))).toEqual([])
  })

  it('[LOAN-R2] rechaza el cuarto préstamo y no descuenta copias', async () => {
    const { app, books, cienAnos } = await appWithBooks()
    for (const book of books.slice(1)) {
      await app.createLoan.execute({ bookId: book.id, borrowerEmail: 'beto@uc.cl' })
    }

    const error = await rejectionOf(
      app.createLoan.execute({ bookId: cienAnos.id, borrowerEmail: 'beto@uc.cl' }),
    )

    expect(error).toBeInstanceOf(LoanLimitReachedError)
    expect((await app.books.findById(cienAnos.id))?.availableCopies).toBe(3)
  })

  it('[LOAN-R4] rechaza pedir otra vez un libro que la persona no ha devuelto', async () => {
    const { app, cienAnos } = await appWithBooks()
    await app.createLoan.execute({ bookId: cienAnos.id, borrowerEmail: 'ana@uc.cl' })

    const error = await rejectionOf(
      app.createLoan.execute({ bookId: cienAnos.id, borrowerEmail: 'ANA@uc.cl' }),
    )

    expect(error).toBeInstanceOf(DuplicateLoanError)
    expect((await app.books.findById(cienAnos.id))?.availableCopies).toBe(2)
  })

  it('[LOAN-R7] un libro inexistente responde BOOK_NOT_FOUND', async () => {
    const { app } = await appWithBooks()

    const error = await rejectionOf(
      app.createLoan.execute({ bookId: nextUuid(), borrowerEmail: 'ana@uc.cl' }),
    )

    expect(error).toBeInstanceOf(BookNotFoundError)
  })
})
