import type { DataSource } from 'typeorm'
import { NoCopiesAvailableError } from '../../books/domain/book.errors'
import { TypeOrmBookRepository } from '../../books/infrastructure/typeorm-book.repository'
import { FixedClock } from '../../shared/infrastructure/clock/fixed-clock'
import { TypeOrmUnitOfWork } from '../../shared/infrastructure/database/typeorm-unit-of-work'
import {
  holdBookRows,
  openMigratedDataSource,
  truncateAll,
  waitForBlockedSessions,
} from '../../../test/support/database'
import { rejectionOf } from '../../../test/support/errors'
import { loanRepositoryContract } from '../../../test/repository-contract/loan-repository.contract'
import { aBook, CATALOG, FIXED_NOW } from '../../../test/support/test-data'
import { CreateLoan } from '../application/create-loan'
import { LoanLimitReachedError } from '../domain/loan.errors'
import { TypeOrmLoanRepository } from './typeorm-loan.repository'

describe('Préstamos en PostgreSQL (Testcontainers)', () => {
  let dataSource: DataSource
  let books: TypeOrmBookRepository
  let createLoan: CreateLoan

  beforeAll(async () => {
    dataSource = await openMigratedDataSource()
  })

  beforeEach(async () => {
    await truncateAll(dataSource)
    const unitOfWork = new TypeOrmUnitOfWork(dataSource)
    books = new TypeOrmBookRepository(unitOfWork)
    const loans = new TypeOrmLoanRepository(unitOfWork)
    createLoan = new CreateLoan(books, loans, unitOfWork, new FixedClock(FIXED_NOW))
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  loanRepositoryContract('PostgreSQL', async () => {
    await truncateAll(dataSource)
    const unitOfWork = new TypeOrmUnitOfWork(dataSource)
    return {
      books: new TypeOrmBookRepository(unitOfWork),
      loans: new TypeOrmLoanRepository(unitOfWork),
    }
  })

  it('[LOAN-R4] el índice único parcial solo bloquea préstamos no devueltos', async () => {
    const book = aBook(CATALOG.cienAnos, 3)
    await books.add(book)
    const insertLoan = (returnedAt: string | null) =>
      dataSource.query(
        `INSERT INTO loans (id, book_id, borrower_email, loaned_at, due_at, returned_at)
         VALUES (gen_random_uuid(), $1, 'ana@uc.cl', now(), now() + interval '14 days', $2)`,
        [book.id, returnedAt],
      )
    await insertLoan(FIXED_NOW) // uno ya devuelto no molesta
    await insertLoan(null)

    const error = await rejectionOf(insertLoan(null))

    expect(error).toMatchObject({
      driverError: { code: '23505', constraint: 'uq_loans_unreturned_book_borrower' },
    })
  })

  it('[LOAN-R1] cinco solicitudes simultáneas por la última copia: exactamente una gana', async () => {
    const book = aBook(CATALOG.casaEspiritus, 1)
    await books.add(book)
    const emails = ['ana', 'beto', 'carla', 'diego', 'eva'].map((name) => `${name}@uc.cl`)

    // Las cinco leen "1 copia disponible" y quedan esperando en el UPDATE condicional.
    const barrier = await holdBookRows(dataSource, [book.id])
    const pending = emails.map((borrowerEmail) =>
      createLoan.execute({ bookId: book.id, borrowerEmail }),
    )
    await waitForBlockedSessions(dataSource, emails.length)
    await barrier.release()
    const results = await Promise.allSettled(pending)

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected.map((result) => result.reason)).toEqual(
      Array.from({ length: 4 }, () => expect.any(NoCopiesAvailableError)),
    )
    expect((await books.findById(book.id))?.availableCopies).toBe(0)
    expect(await dataSource.query('SELECT count(*)::int AS total FROM loans')).toEqual([
      { total: 1 },
    ])
  })

  it('[LOAN-R2] tres solicitudes simultáneas de quien ya tiene 2 préstamos: solo una gana', async () => {
    const catalog = [
      CATALOG.cienAnos,
      CATALOG.ficciones,
      CATALOG.desolacion,
      CATALOG.pedroParamo,
      CATALOG.veintePoemas,
    ].map((entry) => aBook(entry, 2))
    for (const book of catalog) await books.add(book)
    await createLoan.execute({ bookId: catalog[0].id, borrowerEmail: 'beto@uc.cl' })
    await createLoan.execute({ bookId: catalog[1].id, borrowerEmail: 'beto@uc.cl' })

    // Sin el advisory lock por correo, las tres leerían "2 préstamos" y pasarían LOAN-R2.
    const targets = catalog.slice(2)
    const barrier = await holdBookRows(
      dataSource,
      targets.map((book) => book.id),
    )
    const pending = targets.map((book) =>
      createLoan.execute({ bookId: book.id, borrowerEmail: 'beto@uc.cl' }),
    )
    await waitForBlockedSessions(dataSource, targets.length)
    await barrier.release()
    const results = await Promise.allSettled(pending)

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(
      results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : [])),
    ).toEqual([expect.any(LoanLimitReachedError), expect.any(LoanLimitReachedError)])
  })
})
