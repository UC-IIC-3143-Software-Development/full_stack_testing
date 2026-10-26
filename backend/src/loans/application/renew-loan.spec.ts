import { createApplication } from '../../../test/support/application-harness'
import { rejectionOf } from '../../../test/support/errors'
import { aBook, CATALOG, nextUuid } from '../../../test/support/test-data'
import { LoanNotFoundError } from '../domain/loan.errors'

describe('RenewLoan', () => {
  it('[RENEW-R1] renueva con la hora del reloj y guarda la nueva fecha de devolución', async () => {
    const app = createApplication()
    const book = aBook(CATALOG.cienAnos, 2)
    await app.books.add(book)
    const loan = await app.createLoan.execute({ bookId: book.id, borrowerEmail: 'ana@uc.cl' })
    app.clock.advance(3 * 24 * 60 * 60 * 1000)

    const renewed = await app.renewLoan.execute(loan.id)

    expect(renewed).toMatchObject({
      loanedAt: new Date('2026-03-02T12:00:00.000Z'),
      dueAt: new Date('2026-03-23T12:00:00.000Z'),
      renewalCount: 1,
      status: 'ACTIVE',
    })
    const stored = await app.loans.findById(loan.id)
    expect([stored?.dueAt.toISOString(), stored?.renewalCount]).toEqual([
      '2026-03-23T12:00:00.000Z',
      1,
    ])
  })

  it('[RENEW-R4] un préstamo inexistente responde LOAN_NOT_FOUND', async () => {
    const app = createApplication()

    const error = await rejectionOf(app.renewLoan.execute(nextUuid()))

    expect(error).toBeInstanceOf(LoanNotFoundError)
    expect(error).toMatchObject({ code: 'LOAN_NOT_FOUND' })
  })
})
