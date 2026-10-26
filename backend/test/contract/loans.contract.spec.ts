import request from 'supertest'
import { truncateAll } from '../support/database'
import { createBook, createLoan } from '../support/contract-api'
import { startApp, type RunningApp } from '../support/contract-app'
import { expectToMatchContract } from '../support/openapi-contract'
import { CATALOG } from '../support/test-data'

describe('Contrato HTTP: préstamos (SPEC-LIB-02)', () => {
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

  it('[LOAN-R1] [LOAN-R3] [LOAN-R5] flujo completo: prestar, agotar, listar, devolver y devolver otra vez', async () => {
    const book = await createBook(running.http, CATALOG.casaEspiritus, 1)

    const loan = await request(running.http)
      .post('/api/loans')
      .send({ bookId: book.id, borrowerEmail: 'Ana@UC.cl' })
    await expectToMatchContract(loan, 'createLoan')
    expect(loan.status).toBe(201)
    expect(loan.body).toMatchObject({
      bookId: book.id,
      bookTitle: 'La casa de los espíritus',
      borrowerEmail: 'ana@uc.cl',
      loanedAt: '2026-03-02T12:00:00.000Z',
      dueAt: '2026-03-16T12:00:00.000Z',
      returnedAt: null,
      status: 'ACTIVE',
    })

    const exhausted = await request(running.http)
      .post('/api/loans')
      .send({ bookId: book.id, borrowerEmail: 'beto@uc.cl' })
    await expectToMatchContract(exhausted, 'createLoan')
    expect(exhausted.status).toBe(409)
    expect(exhausted.body).toMatchObject({ code: 'NO_COPIES_AVAILABLE' })

    const list = await request(running.http).get('/api/loans').query({ borrowerEmail: 'ANA@uc.cl' })
    await expectToMatchContract(list, 'listLoans')
    expect(list.body).toEqual([loan.body])

    const returned = await request(running.http).post(`/api/loans/${loan.body.id}/return`)
    await expectToMatchContract(returned, 'returnLoan')
    expect(returned.status).toBe(200)
    expect(returned.body).toMatchObject({
      returnedAt: '2026-03-02T12:00:00.000Z',
      status: 'RETURNED',
    })

    const again = await request(running.http).post(`/api/loans/${loan.body.id}/return`)
    await expectToMatchContract(again, 'returnLoan')
    expect(again.status).toBe(409)
    expect(again.body).toMatchObject({ code: 'ALREADY_RETURNED' })

    const bookAfter = await request(running.http).get(`/api/books/${book.id}`)
    await expectToMatchContract(bookAfter, 'getBook')
    expect(bookAfter.body).toMatchObject({ availableCopies: 1 })
  })

  it('[LOAN-R2] el cuarto préstamo responde 409 LOAN_LIMIT_REACHED', async () => {
    const books = [
      await createBook(running.http, CATALOG.cienAnos, 3),
      await createBook(running.http, CATALOG.ficciones, 2),
      await createBook(running.http, CATALOG.desolacion, 1),
      await createBook(running.http, CATALOG.veintePoemas, 2),
    ]
    for (const book of books.slice(0, 3)) {
      await createLoan(running.http, book.id, 'beto@uc.cl')
    }

    const fourth = await request(running.http)
      .post('/api/loans')
      .send({ bookId: books[3].id, borrowerEmail: 'beto@uc.cl' })

    await expectToMatchContract(fourth, 'createLoan')
    expect(fourth.status).toBe(409)
    expect(fourth.body).toMatchObject({
      code: 'LOAN_LIMIT_REACHED',
      detail: 'beto@uc.cl ya tiene 3 préstamos activos',
    })
  })

  it('[LOAN-R4] pedir dos veces el mismo libro responde 409 DUPLICATE_LOAN', async () => {
    const book = await createBook(running.http, CATALOG.cienAnos, 3)
    await createLoan(running.http, book.id, 'ana@uc.cl')

    const duplicated = await request(running.http)
      .post('/api/loans')
      .send({ bookId: book.id, borrowerEmail: 'ana@uc.cl' })

    await expectToMatchContract(duplicated, 'createLoan')
    expect(duplicated.status).toBe(409)
    expect(duplicated.body).toMatchObject({ code: 'DUPLICATE_LOAN' })
  })

  it('[LOAN-R7] un correo inválido responde 400 y un libro inexistente responde 404', async () => {
    const book = await createBook(running.http, CATALOG.cienAnos, 3)

    const invalidEmail = await request(running.http)
      .post('/api/loans')
      .send({ bookId: book.id, borrowerEmail: 'ana-arroba-uc.cl' })
    await expectToMatchContract(invalidEmail, 'createLoan')
    expect(invalidEmail.status).toBe(400)
    expect(invalidEmail.body.errors).toEqual([
      { field: 'borrowerEmail', message: 'Debe ser un correo válido' },
    ])

    const missingBook = await request(running.http)
      .post('/api/loans')
      .send({ bookId: '3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f', borrowerEmail: 'ana@uc.cl' })
    await expectToMatchContract(missingBook, 'createLoan')
    expect(missingBook.status).toBe(404)
    expect(missingBook.body).toMatchObject({ code: 'BOOK_NOT_FOUND' })

    const listWithoutEmail = await request(running.http).get('/api/loans')
    await expectToMatchContract(listWithoutEmail, 'listLoans')
    expect(listWithoutEmail.status).toBe(400)
  })

  it('[LOAN-R5] devolver un préstamo inexistente responde 404 y un id que no es UUID 400', async () => {
    const missing = await request(running.http).post(
      '/api/loans/3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f/return',
    )
    await expectToMatchContract(missing, 'returnLoan')
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ code: 'LOAN_NOT_FOUND' })

    const notUuid = await request(running.http).post('/api/loans/123/return')
    await expectToMatchContract(notUuid, 'returnLoan')
    expect(notUuid.status).toBe(400)
  })
})
