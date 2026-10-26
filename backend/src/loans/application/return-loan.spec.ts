import { createApplication } from '../../../test/support/application-harness'
import { rejectionOf } from '../../../test/support/errors'
import { aBook, CATALOG, nextUuid } from '../../../test/support/test-data'
import { AlreadyReturnedError, LoanNotFoundError } from '../domain/loan.errors'

async function appWithLoan() {
  const app = createApplication()
  const book = aBook(CATALOG.ficciones, 2)
  await app.books.add(book)
  const loan = await app.createLoan.execute({ bookId: book.id, borrowerEmail: 'ana@uc.cl' })
  return { app, book, loan }
}

describe('ReturnLoan', () => {
  it('[LOAN-R5] registra la devolución con la hora del reloj y repone la copia', async () => {
    const { app, book, loan } = await appWithLoan()
    app.clock.advance(3 * 24 * 60 * 60 * 1000)

    const returned = await app.returnLoan.execute(loan.id)

    expect(returned).toMatchObject({
      returnedAt: new Date('2026-03-05T12:00:00.000Z'),
      status: 'RETURNED',
    })
    expect((await app.books.findById(book.id))?.availableCopies).toBe(2)
  })

  it('[LOAN-R5] devolver dos veces responde ALREADY_RETURNED y repone una sola copia', async () => {
    const { app, book, loan } = await appWithLoan()
    await app.returnLoan.execute(loan.id)

    const error = await rejectionOf(app.returnLoan.execute(loan.id))

    expect(error).toBeInstanceOf(AlreadyReturnedError)
    expect((await app.books.findById(book.id))?.availableCopies).toBe(2)
  })

  it('[LOAN-R5] un préstamo inexistente responde LOAN_NOT_FOUND', async () => {
    const { app } = await appWithLoan()

    expect(await rejectionOf(app.returnLoan.execute(nextUuid()))).toBeInstanceOf(LoanNotFoundError)
  })
})
