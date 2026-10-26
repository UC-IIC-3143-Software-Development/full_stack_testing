// Tests de servicio: verifican integración y reglas de dominio del endpoint.
// La validación de cada campo ya está cubierta en validateLine (unit).
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { createInventory } from '../../src/inventory.js'

let app
let inventory
const auth = { Authorization: 'Bearer token' }

beforeEach(() => {
  inventory = createInventory({ A: 5, B: 1 })
  app = createApp({ inventory, validTokens: new Set(['token']) })
})

describe('POST /orders', () => {
  it('creates the order, reserves stock and makes it retrievable', async () => {
    const created = await request(app)
      .post('/orders')
      .set(auth)
      .send({
        items: [
          { sku: 'A', qty: 2, price: 10 },
          { sku: 'B', qty: 1, price: -5 },
        ],
      })

    expect(created.status).toBe(201)
    expect(created.body.total).toBe(15)
    expect(inventory.stockOf('A')).toBe(3)

    const fetched = await request(app).get(`/orders/${created.body.id}`).set(auth)
    expect(fetched.body).toEqual(created.body)
  })

  it.each([
    ['no header', {}],
    ['an unknown token', { Authorization: 'Bearer other' }],
    ['a non-Bearer scheme', { Authorization: 'Basic token' }],
  ])('rejects requests with %s', async (_, headers) => {
    const res = await request(app).post('/orders').set(headers).send({})
    expect(res.status).toBe(401)
  })

  it('returns the validation errors of the lines', async () => {
    const res = await request(app)
      .post('/orders')
      .set(auth)
      .send({ items: [{ sku: 'A', qty: 0, price: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.errors).toEqual(['qty must be a positive integer'])
  })

  it('rejects an empty order', async () => {
    const res = await request(app).post('/orders').set(auth).send({ items: [] })
    expect(res.status).toBe(400)
  })

  it('rejects the whole order without reserving anything when a SKU is out of stock', async () => {
    const res = await request(app)
      .post('/orders')
      .set(auth)
      .send({
        items: [
          { sku: 'A', qty: 1, price: 10 },
          { sku: 'B', qty: 2, price: 10 },
        ],
      })

    expect(res.status).toBe(409)
    expect(res.body.skus).toEqual(['B'])
    expect(inventory.stockOf('A')).toBe(5)
  })
})

describe('GET /orders/:id', () => {
  it('returns 404 for an unknown order', async () => {
    const res = await request(app).get('/orders/999').set(auth)
    expect(res.status).toBe(404)
  })
})
