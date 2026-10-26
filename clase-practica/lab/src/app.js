import express from 'express'
import { orderTotal, validateLine } from './orders.js'

export function createApp({ inventory, validTokens }) {
  const app = express()
  const orders = new Map()
  let nextId = 1

  app.use(express.json())

  function requireAuth(req, res, next) {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ')
    if (scheme !== 'Bearer' || !validTokens.has(token)) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    next()
  }

  app.post('/orders', requireAuth, (req, res) => {
    const items = req.body?.items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ errors: ['items must be a non-empty array'] })
    }

    const errors = items.flatMap(validateLine)
    if (errors.length > 0) {
      return res.status(400).json({ errors })
    }

    const unavailable = items.filter((i) => !inventory.isAvailable(i.sku, i.qty))
    if (unavailable.length > 0) {
      return res.status(409).json({ error: 'out of stock', skus: unavailable.map((i) => i.sku) })
    }

    for (const i of items) inventory.reserve(i.sku, i.qty)
    const total = orderTotal(items.flatMap((i) => Array(i.qty).fill(i.price)))
    const order = { id: String(nextId++), items, total }
    orders.set(order.id, order)
    res.status(201).json(order)
  })

  app.get('/orders/:id', requireAuth, (req, res) => {
    const order = orders.get(req.params.id)
    if (!order) return res.status(404).json({ error: 'not found' })
    res.json(order)
  })

  return app
}
