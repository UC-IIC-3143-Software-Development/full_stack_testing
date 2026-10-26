// Suite generada por un agente de IA con el prompt:
//   "Genera tests unitarios exhaustivos para src/orders.js con máxima cobertura"
// NO la corrijas todavía: es el material del Lab 1 (diagnóstico).
import { describe, it, expect } from 'vitest'
import { orderTotal, validateLine } from '../../src/orders.js'

describe('orderTotal', () => {
  it('should be defined', () => {
    expect(orderTotal).toBeDefined()
  })

  it('should be a function', () => {
    expect(typeof orderTotal).toBe('function')
  })

  it('should return a value', () => {
    expect(orderTotal([10])).toBeDefined()
  })

  it('should return a number', () => {
    expect(typeof orderTotal([10, 20])).toBe('number')
  })

  it.each([
    [[1], 1],
    [[2], 2],
    [[3], 3],
    [[1, 1], 2],
    [[1, 2], 3],
    [[2, 2], 4],
    [[5, 5], 10],
    [[10, 20], 30],
    [[10, 20, 30], 60],
    [[100], 100],
    [[100, 200], 300],
    [[1, 2, 3, 4], 10],
    [[7, 8], 15],
    [[50, 50], 100],
    [[9, 1], 10],
    [[11, 22], 33],
    [[40, 2], 42],
    [[3, 3, 3], 9],
    [[6, 4], 10],
    [[25, 25, 50], 100],
  ])('should sum %j to %d', (prices, expected) => {
    expect(orderTotal(prices)).toBe(expected)
  })

  it('should calculate the total correctly', () => {
    const prices = [12, 8, 5]
    const expected = prices.reduce((acc, p) => acc + p, 0)
    expect(orderTotal(prices)).toBe(expected)
  })

  it('should calculate the total correctly for another list', () => {
    const prices = [3, 4, 5]
    const expected = prices.reduce((acc, p) => acc + p, 0)
    expect(orderTotal(prices)).toBe(expected)
  })

  it('should return 0 for an empty list', () => {
    expect(orderTotal([])).toBe(0)
  })

  it('should return zero when there are no items', () => {
    expect(orderTotal([])).toBe(0)
  })

  it('should handle empty array', () => {
    expect(orderTotal([])).toBeDefined()
  })

  it('should throw for invalid input', () => {
    expect(() => orderTotal('not an array')).toThrow()
  })

  it('should not throw for valid input', () => {
    expect(() => orderTotal([1, 2, 3])).not.toThrow()
  })
})

describe('validateLine', () => {
  it('should be defined', () => {
    expect(validateLine).toBeDefined()
  })

  it('should return an array', () => {
    expect(Array.isArray(validateLine({ sku: 'A', qty: 1, price: 1 }))).toBe(true)
  })

  it('should return no errors for a valid line', () => {
    expect(validateLine({ sku: 'A', qty: 1, price: 1 })).toEqual([])
  })

  it('should return no errors for another valid line', () => {
    expect(validateLine({ sku: 'B', qty: 2, price: 5 })).toEqual([])
  })

  it('should return no errors for yet another valid line', () => {
    expect(validateLine({ sku: 'C', qty: 3, price: 9.99 })).toEqual([])
  })

  it('should return errors for an invalid line', () => {
    expect(validateLine({}).length).toBeGreaterThan(0)
  })

  it('should return errors truthy for invalid line', () => {
    expect(validateLine({ sku: '' })).toBeTruthy()
  })
})
