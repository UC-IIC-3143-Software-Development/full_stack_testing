import { DomainValidationError } from '../../shared/domain/domain-error'

export const INVALID_ISBN_MESSAGE = 'El ISBN no es válido'

/**
 * Value object ISBN-13 (BOOK-R1). Se normaliza quitando guiones y espacios. Debe tener
 * 13 dígitos, empezar con 978 o 979 y tener el dígito verificador correcto.
 */
export class Isbn {
  private constructor(readonly value: string) {}

  static create(raw: string): Isbn {
    const normalized = raw.replace(/[-\s]/g, '')
    if (!/^97[89]\d{10}$/.test(normalized) || !hasValidCheckDigit(normalized)) {
      throw new DomainValidationError('isbn', INVALID_ISBN_MESSAGE)
    }
    return new Isbn(normalized)
  }

  equals(other: Isbn): boolean {
    return this.value === other.value
  }
}

/** Pesos 1 y 3 alternados sobre los 12 primeros dígitos, módulo 10. */
function hasValidCheckDigit(digits: string): boolean {
  const sum = [...digits.slice(0, 12)].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  )
  const expected = (10 - (sum % 10)) % 10
  return expected === Number(digits[12])
}
