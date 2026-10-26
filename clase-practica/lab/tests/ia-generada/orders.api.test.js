// Suite generada por un agente de IA con el prompt:
//   "Genera tests de API completos para POST /orders y GET /orders/:id"
// Igual que el ejemplo del libro (cap. 3, p. 102): ~30 tests, casi todos
// validación de inputs y solo aserciones sobre el status code.
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { createInventory } from '../../src/inventory.js'

const app = createApp({
  inventory: createInventory({ 'SKU-1': 1000, 'SKU-2': 1000, 'SKU-3': 1000, 'SKU-LOW': 1 }),
  validTokens: new Set(['token']),
})
const auth = { Authorization: 'Bearer token' }
const post = (body, headers = auth) => request(app).post('/orders').set(headers).send(body)

describe('POST /orders', () => {
  it('should create an order', async () => {
    const res = await post({ items: [{ sku: 'SKU-1', qty: 1, price: 10 }] })
    expect(res.status).toBe(201)
  })

  it('should create an order with SKU-2', async () => {
    const res = await post({ items: [{ sku: 'SKU-2', qty: 1, price: 10 }] })
    expect(res.status).toBe(201)
  })

  it('should create an order with SKU-3', async () => {
    const res = await post({ items: [{ sku: 'SKU-3', qty: 1, price: 10 }] })
    expect(res.status).toBe(201)
  })

  it('should create an order with two items', async () => {
    const res = await post({
      items: [
        { sku: 'SKU-1', qty: 1, price: 10 },
        { sku: 'SKU-2', qty: 1, price: 5 },
      ],
    })
    expect(res.status).toBe(201)
  })

  it('should create an order with quantity 2', async () => {
    const res = await post({ items: [{ sku: 'SKU-1', qty: 2, price: 10 }] })
    expect(res.status).toBe(201)
  })

  it('should return a body', async () => {
    const res = await post({ items: [{ sku: 'SKU-1', qty: 1, price: 10 }] })
    expect(res.body).toBeTruthy()
  })

  it('should return an id', async () => {
    const res = await post({ items: [{ sku: 'SKU-1', qty: 1, price: 10 }] })
    expect(res.body.id).toBeDefined()
  })

  it('should return a total', async () => {
    const res = await post({ items: [{ sku: 'SKU-1', qty: 1, price: 10 }] })
    expect(res.body).toHaveProperty('total')
  })

  it('should return JSON', async () => {
    const res = await post({ items: [{ sku: 'SKU-1', qty: 1, price: 10 }] })
    expect(res.headers['content-type']).toMatch(/json/)
  })

  it('should respond in less than 200ms', async () => {
    const start = Date.now()
    await post({ items: [{ sku: 'SKU-1', qty: 1, price: 10 }] })
    expect(Date.now() - start).toBeLessThan(200)
  })

  it('should return 401 without token', async () => {
    const res = await post({ items: [{ sku: 'SKU-1', qty: 1, price: 10 }] }, {})
    expect(res.status).toBe(401)
  })

  it('should return 401 with invalid token', async () => {
    const res = await post(
      { items: [{ sku: 'SKU-1', qty: 1, price: 10 }] },
      { Authorization: 'Bearer nope' },
    )
    expect(res.status).toBe(401)
  })

  it('should return 401 with malformed header', async () => {
    const res = await post(
      { items: [{ sku: 'SKU-1', qty: 1, price: 10 }] },
      { Authorization: 'token' },
    )
    expect(res.status).toBe(401)
  })

  it('should return 401 with empty bearer', async () => {
    const res = await post(
      { items: [{ sku: 'SKU-1', qty: 1, price: 10 }] },
      { Authorization: 'Bearer ' },
    )
    expect(res.status).toBe(401)
  })

  it('should return 400 when body is empty', async () => {
    expect((await post({})).status).toBe(400)
  })

  it('should return 400 when items is empty', async () => {
    expect((await post({ items: [] })).status).toBe(400)
  })

  it('should return 400 when items is not an array', async () => {
    expect((await post({ items: 'x' })).status).toBe(400)
  })

  it('should return 400 when sku is missing', async () => {
    expect((await post({ items: [{ qty: 1, price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when sku is empty', async () => {
    expect((await post({ items: [{ sku: '', qty: 1, price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when sku is blank', async () => {
    expect((await post({ items: [{ sku: '   ', qty: 1, price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when sku is a number', async () => {
    expect((await post({ items: [{ sku: 123, qty: 1, price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when qty is missing', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when qty is zero', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', qty: 0, price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when qty is negative', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', qty: -1, price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when qty is decimal', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', qty: 1.5, price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when qty is a string', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', qty: '1', price: 10 }] })).status).toBe(400)
  })

  it('should return 400 when price is missing', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', qty: 1 }] })).status).toBe(400)
  })

  it('should return 400 when price is a string', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', qty: 1, price: '10' }] })).status).toBe(400)
  })

  it('should return 400 when price is null', async () => {
    expect((await post({ items: [{ sku: 'SKU-1', qty: 1, price: null }] })).status).toBe(400)
  })

  it('should return 400 when item is null', async () => {
    expect((await post({ items: [null] })).status).toBe(400)
  })

  it('should return 409 when out of stock', async () => {
    expect((await post({ items: [{ sku: 'SKU-LOW', qty: 5, price: 10 }] })).status).toBe(409)
  })

  it('should return 409 for unknown sku', async () => {
    expect((await post({ items: [{ sku: 'NOPE', qty: 1, price: 10 }] })).status).toBe(409)
  })
})

describe('GET /orders/:id', () => {
  // Depende de que los tests anteriores hayan creado la orden "1".
  it('should get order 1', async () => {
    const res = await request(app).get('/orders/1').set(auth)
    expect(res.status).toBe(200)
  })

  it('should get order 2', async () => {
    const res = await request(app).get('/orders/2').set(auth)
    expect(res.status).toBe(200)
  })

  it('should return 404 for unknown order', async () => {
    const res = await request(app).get('/orders/999999').set(auth)
    expect(res.status).toBe(404)
  })

  it('should return 401 without token', async () => {
    const res = await request(app).get('/orders/1')
    expect(res.status).toBe(401)
  })
})
