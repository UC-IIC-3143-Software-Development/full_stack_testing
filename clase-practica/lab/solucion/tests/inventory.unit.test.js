import { describe, it, expect } from 'vitest'
import { createInventory } from '../../src/inventory.js'

describe('inventory', () => {
  it('is available when stock covers the quantity exactly', () => {
    const inventory = createInventory({ A: 2 })
    expect(inventory.isAvailable('A', 2)).toBe(true)
    expect(inventory.isAvailable('A', 3)).toBe(false)
  })

  it('treats unknown SKUs as zero stock', () => {
    const inventory = createInventory()
    expect(inventory.isAvailable('X', 1)).toBe(false)
    expect(inventory.stockOf('X')).toBe(0)
  })

  it('decrements stock on reserve', () => {
    const inventory = createInventory({ A: 5 })
    inventory.reserve('A', 2)
    expect(inventory.stockOf('A')).toBe(3)
  })
})
