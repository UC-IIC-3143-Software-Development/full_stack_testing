import request from 'supertest'
import { truncateAll } from '../support/database'
import { createBook, createLoan } from '../support/contract-api'
import { startApp, type RunningApp } from '../support/contract-app'
import { expectToMatchContract } from '../support/openapi-contract'
import { CATALOG } from '../support/test-data'

const OLDEST_OVERDUE = '1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e701'
const RECENT_OVERDUE = '1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e702'
const RETURNED_LATE = '1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e703'
const OTHER_BORROWER = '1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e704'

describe('Contrato HTTP: préstamos vencidos (SPEC-LIB-02)', () => {
  let running: RunningApp

  beforeAll(async () => {
    running = await startApp()
  })

  beforeEach(async () => {
    await truncateAll(running.dataSource)
  })

  afterAll(async () => {
    await running.app.close()
  })

  async function insertLoan(
    id: string,
    bookId: string,
    borrowerEmail: string,
    loanedAt: string,
    dueAt: string,
    returnedAt: string | null = null,
  ): Promise<void> {
    await running.dataSource.query(
      `INSERT INTO loans (id, book_id, borrower_email, loaned_at, due_at, returned_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, bookId, borrowerEmail, loanedAt, dueAt, returnedAt],
    )
  }

  it('[LOAN-R8] lista solo los préstamos vencidos de la persona, del que venció hace más tiempo al más reciente', async () => {
    const ficciones = await createBook(running.http, CATALOG.ficciones, 2)
    const desolacion = await createBook(running.http, CATALOG.desolacion, 1)
    const pedroParamo = await createBook(running.http, CATALOG.pedroParamo, 1)
    const cienAnos = await createBook(running.http, CATALOG.cienAnos, 1)
    // Con la fecha fija de prueba (2026-03-02) ningún préstamo creado por la API está vencido:
    // se insertan préstamos con fechas pasadas. Uno ya se devolvió y otro es de otra persona.
    await insertLoan(
      RECENT_OVERDUE,
      ficciones.id,
      'ana@uc.cl',
      '2026-02-10T12:00:00Z',
      '2026-02-24T12:00:00Z',
    )
    await insertLoan(
      OLDEST_OVERDUE,
      desolacion.id,
      'ana@uc.cl',
      '2026-01-20T12:00:00Z',
      '2026-02-03T12:00:00Z',
    )
    await insertLoan(
      RETURNED_LATE,
      pedroParamo.id,
      'ana@uc.cl',
      '2026-01-05T12:00:00Z',
      '2026-01-19T12:00:00Z',
      '2026-01-25T12:00:00Z',
    )
    await insertLoan(
      OTHER_BORROWER,
      ficciones.id,
      'beto@uc.cl',
      '2026-02-01T12:00:00Z',
      '2026-02-15T12:00:00Z',
    )
    await createLoan(running.http, cienAnos.id, 'ana@uc.cl')

    const overdue = await request(running.http)
      .get('/api/loans/overdue')
      .query({ borrowerEmail: 'ANA@uc.cl', limit: 10 })

    await expectToMatchContract(overdue, 'listOverdueLoans')
    expect(overdue.status).toBe(200)
    expect(overdue.body).toEqual([
      {
        id: OLDEST_OVERDUE,
        bookId: desolacion.id,
        bookTitle: 'Desolación',
        borrowerEmail: 'ana@uc.cl',
        loanedAt: '2026-01-20T12:00:00.000Z',
        dueAt: '2026-02-03T12:00:00.000Z',
        returnedAt: null,
        status: 'OVERDUE',
        renewalCount: 0,
      },
      {
        id: RECENT_OVERDUE,
        bookId: ficciones.id,
        bookTitle: 'Ficciones',
        borrowerEmail: 'ana@uc.cl',
        loanedAt: '2026-02-10T12:00:00.000Z',
        dueAt: '2026-02-24T12:00:00.000Z',
        returnedAt: null,
        status: 'OVERDUE',
        renewalCount: 0,
      },
    ])
  })
})
