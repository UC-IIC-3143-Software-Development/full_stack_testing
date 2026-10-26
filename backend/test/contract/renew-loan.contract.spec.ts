import request from 'supertest'
import { truncateAll } from '../support/database'
import { createBook, createLoan } from '../support/contract-api'
import { startApp, type RunningApp } from '../support/contract-app'
import { expectToMatchContract } from '../support/openapi-contract'
import { CATALOG } from '../support/test-data'

describe('Contrato HTTP: renovar préstamo (SPEC-LIB-03)', () => {
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

  it('[RENEW-R1] [RENEW-R2] renovar responde 200 con 7 días más y renovar otra vez responde 409 RENEWAL_LIMIT_REACHED', async () => {
    const book = await createBook(running.http, CATALOG.cienAnos, 1)
    const loan = await createLoan(running.http, book.id, 'ana@uc.cl')

    const renewed = await request(running.http).post(`/api/loans/${loan.id}/renew`)
    await expectToMatchContract(renewed, 'renewLoan')
    expect(renewed.status).toBe(200)
    expect(renewed.body).toMatchObject({
      id: loan.id,
      loanedAt: '2026-03-02T12:00:00.000Z',
      dueAt: '2026-03-23T12:00:00.000Z',
      returnedAt: null,
      status: 'ACTIVE',
      renewalCount: 1,
    })

    const list = await request(running.http).get('/api/loans').query({ borrowerEmail: 'ana@uc.cl' })
    await expectToMatchContract(list, 'listLoans')
    expect(list.body).toEqual([renewed.body])

    const again = await request(running.http).post(`/api/loans/${loan.id}/renew`)
    await expectToMatchContract(again, 'renewLoan')
    expect(again.status).toBe(409)
    expect(again.body).toMatchObject({
      code: 'RENEWAL_LIMIT_REACHED',
      detail: 'El préstamo ya fue renovado',
    })
  })

  it('[RENEW-R3] renovar un préstamo vencido responde 409 LOAN_OVERDUE', async () => {
    const book = await createBook(running.http, CATALOG.ficciones, 1)
    // Con el reloj fijo (2026-03-02) ningún préstamo creado por la API está vencido:
    // se inserta uno que venció el 2026-02-15.
    const overdueId = '7c1d2e3f-4a5b-4c6d-8e7f-8a9b0c1d2e3f'
    await running.dataSource.query(
      `INSERT INTO loans (id, book_id, borrower_email, loaned_at, due_at, returned_at)
       VALUES ($1, $2, 'beto@uc.cl', '2026-02-01T12:00:00Z', '2026-02-15T12:00:00Z', NULL)`,
      [overdueId, book.id],
    )

    const response = await request(running.http).post(`/api/loans/${overdueId}/renew`)

    await expectToMatchContract(response, 'renewLoan')
    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({ code: 'LOAN_OVERDUE' })
  })

  it('[RENEW-R4] renovar un préstamo inexistente responde 404 y un id que no es UUID 400', async () => {
    const missing = await request(running.http).post(
      '/api/loans/3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f/renew',
    )
    await expectToMatchContract(missing, 'renewLoan')
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ code: 'LOAN_NOT_FOUND' })

    const notUuid = await request(running.http).post('/api/loans/123/renew')
    await expectToMatchContract(notUuid, 'renewLoan')
    expect(notUuid.status).toBe(400)
    expect(notUuid.body).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
