import request from 'supertest'
import type { App } from 'supertest/types'
import { expectToMatchContract } from './openapi-contract'
import type { BookSeed } from './test-data'

export interface BookBody {
  id: string
  title: string
  availableCopies: number
}

export interface LoanBody {
  id: string
  status: string
}

/** Pasos reutilizables de los flujos. Cada respuesta también se valida contra el contrato. */
export async function createBook(http: App, entry: BookSeed, totalCopies = 1): Promise<BookBody> {
  const response = await request(http)
    .post('/api/books')
    .send({ ...entry, totalCopies })
  await expectToMatchContract(response, 'createBook')
  expect(response.status).toBe(201)
  return response.body as BookBody
}

export async function createLoan(
  http: App,
  bookId: string,
  borrowerEmail: string,
): Promise<LoanBody> {
  const response = await request(http).post('/api/loans').send({ bookId, borrowerEmail })
  await expectToMatchContract(response, 'createLoan')
  expect(response.status).toBe(201)
  return response.body as LoanBody
}
