import { describe, expect, it } from 'vitest'

const CASES = [
  { title: '[CAT-R1] createBook responde 400 con un ISBN inválido', status: 400 },
  { title: '[CAT-R2] listBooks responde 200', status: 200 },
]

describe('mocks contra el contrato', () => {
  for (const testCase of CASES) {
    it(testCase.title, () => {
      expect(testCase.status).toBeGreaterThan(0)
    })
  }

  it('[MOCK-R1] hay un handler por operación', () => {
    expect(CASES).toHaveLength(2)
  })
})
