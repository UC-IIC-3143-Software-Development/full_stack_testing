import { describe, expect, it } from 'vitest'
import { formatIsbn, isValidIsbn13, normalizeIsbn } from './isbn'

// Particiones de BOOK-R1: válido (978 y 979), verificador incorrecto, prefijo inválido,
// largo incorrecto y caracteres no numéricos. Una partición, un test (P4.2).
describe('isValidIsbn13', () => {
  it('[BOOK-R1] acepta un ISBN-13 válido escrito con guiones', () => {
    expect(isValidIsbn13('978-84-376-0494-7')).toBe(true)
  })

  it('[BOOK-R1] acepta un ISBN-13 válido con prefijo 979 y espacios', () => {
    expect(isValidIsbn13('979 10 90636 07 1')).toBe(true)
  })

  it('[BOOK-R1] rechaza un ISBN con dígito verificador incorrecto', () => {
    // El 0 sería correcto si los pesos fueran 3 y 1 en vez de 1 y 3: este caso lo agregamos
    // porque Stryker mostró que los otros ejemplos no distinguían el orden de los pesos.
    expect(isValidIsbn13('978-0-307-47472-0')).toBe(false)
  })

  it('[BOOK-R1] rechaza un prefijo distinto de 978 y 979', () => {
    expect(isValidIsbn13('9778437604947')).toBe(false)
  })

  it('[BOOK-R1] rechaza 12 y 14 dígitos (valores límite del largo)', () => {
    expect(isValidIsbn13('978843760494')).toBe(false)
    expect(isValidIsbn13('97884376049470')).toBe(false)
  })

  it('[BOOK-R1] rechaza letras aunque el largo sea correcto', () => {
    expect(isValidIsbn13('978843760494X')).toBe(false)
  })
})

describe('normalizeIsbn y formatIsbn', () => {
  it('[UI-CAT-1] normaliza y vuelve a mostrar el ISBN con guiones', () => {
    expect(normalizeIsbn('978-84-376 0494-7')).toBe('9788437604947')
    expect(formatIsbn('9788437604947')).toBe('978-84-376-0494-7')
  })

  it('[UI-CAT-1] deja sin cambios un valor que no tiene exactamente 13 dígitos', () => {
    expect(formatIsbn('97884376049471')).toBe('97884376049471')
  })
})
