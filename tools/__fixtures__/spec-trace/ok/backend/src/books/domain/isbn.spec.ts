import { Isbn } from './isbn'

describe('Isbn', () => {
  it('[CAT-R1] acepta un ISBN-13 válido', () => {
    expect(Isbn.parse('9780307474728').value).toBe('9780307474728')
  })

  // it('esto está comentado y no cuenta', () => {})

  it.each([
    ['978-0-307-47472-8', '9780307474728'],
    ['978 0 307 47472 8', '9780307474728'],
  ])('[CAT-R1] normaliza %s', (raw, expected) => {
    expect(Isbn.parse(raw).value).toBe(expected)
  })
})
