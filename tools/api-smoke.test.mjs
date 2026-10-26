// Prueba api-smoke y seed-stack contra el fake en memoria de la API.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { createFakeApi } from './__fixtures__/fake-api.mjs'
import { randomIsbn, runSmoke, toMarkdown } from './api-smoke.mjs'
import { SEED_BOOKS, seed } from './seed-stack.mjs'

const listen = (server) =>
  new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`))
  })

describe('api-smoke', () => {
  let fake
  let baseUrl
  before(async () => {
    fake = createFakeApi({ now: () => new Date('2026-03-02T12:00:00Z') })
    baseUrl = await listen(fake)
  })
  after(() => fake.close())

  it('genera ISBN-13 con dígito verificador correcto', () => {
    const isbn = randomIsbn()
    const sum = [...isbn].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
    assert.match(isbn, /^978\d{10}$/)
    assert.equal(sum % 10, 0)
  })

  it('recorre las 7 operaciones del contrato y todas responden lo esperado', async () => {
    const report = await runSmoke({ baseUrl, waitMs: 2000, token: 'abc123' })
    assert.equal(report.ok, true, JSON.stringify(report.results.filter((r) => !r.ok)))
    assert.deepEqual(
      [...new Set(report.results.map((r) => r.operationId))],
      ['getHealth', 'createBook', 'listBooks', 'getBook', 'createLoan', 'listLoans', 'returnLoan'],
    )
    assert.match(toMarkdown(report), /17 de 17 verificaciones OK/)
  })

  it('marca como fallida una API que responde 200 a todo', async () => {
    const liar = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
    const liarUrl = await listen(liar)
    const report = await runSmoke({ baseUrl: liarUrl, waitMs: 1000, token: 'zzz' })
    liar.close()
    assert.equal(report.ok, false)
    const failed = report.results.find((r) => r.name === 'ISBN inválido')
    assert.equal(failed.actual, 200)
    assert.match(failed.error, /se esperaba 400/)
  })
})

describe('seed-stack', () => {
  it('siembra los libros de specs/flows/README.md y es idempotente', async () => {
    const fake = createFakeApi()
    const baseUrl = await listen(fake)
    await seed(baseUrl, () => {})
    await seed(baseUrl, () => {})
    const books = await (await fetch(`${baseUrl}/api/books`)).json()
    fake.close()
    assert.deepEqual(
      books.map((b) => [b.title, b.totalCopies, b.availableCopies]),
      SEED_BOOKS.map((b) => [b.title, b.total, b.available]),
    )
  })
})
