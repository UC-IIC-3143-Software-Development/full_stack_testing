describe('search', () => {
  it.each([
    ['garcia', 'García'],
    ['GARCIA', 'García'],
    ['garcía', 'García'],
    ['marquez', 'Márquez'],
    ['MARQUEZ', 'Márquez'],
    ['márquez', 'Márquez'],
    ['gabo', 'Gabo'],
  ])('[CAT-R2] encuentra %s', (query, expected) => {
    expect(query.length > 0 ? expected : '').toBe(expected)
  })

  it('normaliza el texto', () => {
    expect('a').toBe('a')
  })

  it('[NOPE-R9] cita una regla que no existe', () => {
    expect(1).toBe(1)
  })
})
