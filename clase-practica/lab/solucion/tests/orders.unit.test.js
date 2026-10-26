// Suite curada: una partición de equivalencia por test, oráculo explícito.
import { describe, it, expect } from 'vitest'
import { orderTotal, validateLine } from '../../src/orders.js'

describe('orderTotal', () => {
  it('sums prices, applying negative prices as discounts', () => {
    expect(orderTotal([10, 25.5, -3])).toBe(32.5)
  })

  it('never returns a negative total', () => {
    expect(orderTotal([5, -10])).toBe(0)
  })

  it('avoids floating point drift by summing in cents', () => {
    expect(orderTotal([0.1, 0.2])).toBe(0.3)
  })

  it('returns 0 for an empty order', () => {
    expect(orderTotal([])).toBe(0)
  })

  it.each([
    ['a non-array', 'abc'],
    ['a string price', ['10']],
    ['NaN', [NaN]],
    ['Infinity', [Infinity]],
  ])('rejects %s', (_, input) => {
    expect(() => orderTotal(input)).toThrow(TypeError)
  })
})

describe('validateLine', () => {
  it('accepts a well-formed line', () => {
    expect(validateLine({ sku: 'A', qty: 1, price: 9.99 })).toEqual([])
  })

  // Cada fila nombra su partición de equivalencia: si dos filas no se pueden
  // nombrar distinto, prueban lo mismo.
  it.each([
    ['a missing sku', { qty: 1, price: 1 }, 'sku is required'],
    ['a blank sku', { sku: '  ', qty: 1, price: 1 }, 'sku is required'],
    ['a zero qty', { sku: 'A', qty: 0, price: 1 }, 'qty must be a positive integer'],
    ['a fractional qty', { sku: 'A', qty: 1.5, price: 1 }, 'qty must be a positive integer'],
    ['a non-numeric price', { sku: 'A', qty: 1, price: '1' }, 'price must be a number'],
  ])('reports %s', (_, line, error) => {
    expect(validateLine(line)).toEqual([error])
  })

  it('reports every error of a null line', () => {
    expect(validateLine(null)).toHaveLength(3)
  })
})
