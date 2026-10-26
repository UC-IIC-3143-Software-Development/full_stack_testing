import request from 'supertest'
import { truncateAll } from '../support/database'
import { createBook } from '../support/contract-api'
import { startApp, type RunningApp } from '../support/contract-app'
import { expectToMatchContract } from '../support/openapi-contract'
import { CATALOG } from '../support/test-data'

const rayuela = {
  isbn: '978-84-376-0494-7',
  title: 'Rayuela',
  author: 'Julio Cortázar',
  totalCopies: 2,
}

describe('Contrato HTTP: libros (SPEC-LIB-01)', () => {
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

  it('[BOOK-R2] crea un libro, lo obtiene por id y rechaza el mismo ISBN otra vez', async () => {
    const created = await request(running.http).post('/api/books').send(rayuela)
    await expectToMatchContract(created, 'createBook')
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      isbn: '9788437604947',
      title: 'Rayuela',
      author: 'Julio Cortázar',
      totalCopies: 2,
      availableCopies: 2,
      createdAt: '2026-03-02T12:00:00.000Z',
    })

    const fetched = await request(running.http).get(`/api/books/${created.body.id}`)
    await expectToMatchContract(fetched, 'getBook')
    expect(fetched.body).toEqual(created.body)

    const duplicated = await request(running.http)
      .post('/api/books')
      .send({ ...rayuela, isbn: '9788437604947' })
    await expectToMatchContract(duplicated, 'createBook')
    expect(duplicated.status).toBe(409)
    expect(duplicated.body).toMatchObject({
      code: 'ISBN_ALREADY_EXISTS',
      detail: 'Ya existe un libro con el ISBN 9788437604947',
    })
  })

  it('[BOOK-R1] un ISBN con dígito verificador incorrecto responde 400 en el campo isbn', async () => {
    const response = await request(running.http)
      .post('/api/books')
      .send({ ...rayuela, isbn: '978-0-00-000000-1' })

    await expectToMatchContract(response, 'createBook')
    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'isbn', message: 'El ISBN no es válido' }],
    })
  })

  it('[BOOK-R4] el contrato rechaza copias fuera de rango y campos desconocidos', async () => {
    const response = await request(running.http)
      .post('/api/books')
      .send({ ...rayuela, totalCopies: 51, editorial: 'Sudamericana' })

    await expectToMatchContract(response, 'createBook')
    expect(response.status).toBe(400)
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        { field: 'totalCopies', message: 'Debe ser menor o igual a 50' },
        { field: 'editorial', message: 'El campo no está permitido' },
      ]),
    )
  })

  it('[BOOK-R5] busca sin tildes ni mayúsculas y lista ordenado por título', async () => {
    await createBook(running.http, CATALOG.pedroParamo)
    await createBook(running.http, CATALOG.cienAnos)
    await createBook(running.http, CATALOG.desolacion)

    const search = await request(running.http).get('/api/books').query({ q: 'GARCÍA marquez' })
    await expectToMatchContract(search, 'listBooks')
    expect(search.body.map((book: { title: string }) => book.title)).toEqual([
      'Cien años de soledad',
    ])

    const all = await request(running.http).get('/api/books')
    await expectToMatchContract(all, 'listBooks')
    expect(all.body.map((book: { title: string }) => book.title)).toEqual([
      'Cien años de soledad',
      'Desolación',
      'Pedro Páramo',
    ])

    const tooLong = await request(running.http)
      .get('/api/books')
      .query({ q: 'a'.repeat(101) })
    await expectToMatchContract(tooLong, 'listBooks')
    expect(tooLong.status).toBe(400)
  })

  it('[BOOK-R6] un libro inexistente responde 404 y un id que no es UUID responde 400', async () => {
    const missing = await request(running.http).get(
      '/api/books/3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f',
    )
    await expectToMatchContract(missing, 'getBook')
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ code: 'BOOK_NOT_FOUND' })

    const notUuid = await request(running.http).get('/api/books/rayuela')
    await expectToMatchContract(notUuid, 'getBook')
    expect(notUuid.status).toBe(400)
    expect(notUuid.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'bookId', message: 'Debe ser un UUID válido' }],
    })
  })
})
