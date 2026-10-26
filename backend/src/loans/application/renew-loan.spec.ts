import { createApplication } from '../../../test/support/application-harness'
import { aBook, CATALOG } from '../../../test/support/test-data'

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
})
