import { createApplication } from '../../../test/support/application-harness'
import { aBook, CATALOG } from '../../../test/support/test-data'

describe('ListLoans', () => {
  it('[LOAN-R6] calcula el estado con la hora del reloj, sin guardarlo', async () => {
    const app = createApplication()
    const book = aBook(CATALOG.pedroParamo, 2)
    await app.books.add(book)
    await app.createLoan.execute({ bookId: book.id, borrowerEmail: 'ana@uc.cl' })

    const today = await app.listLoans.execute('ana@uc.cl')
    app.clock.advance(15 * 24 * 60 * 60 * 1000)
    const in15Days = await app.listLoans.execute('ANA@uc.cl')

    expect([today[0].status, in15Days[0].status]).toEqual(['ACTIVE', 'OVERDUE'])
  })
})
