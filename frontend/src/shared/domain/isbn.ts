// BOOK-R1 y UI-CAT-1. Funciones puras: sin React, sin Next, sin red (ARCH-R6).

/** Quita guiones y espacios. "978-84-376-0494-7" pasa a "9788437604947". */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

/**
 * BOOK-R1: 13 dígitos, prefijo 978 o 979 y dígito verificador correcto
 * (pesos 1 y 3 alternados, módulo 10).
 */
export function isValidIsbn13(raw: string): boolean {
  const isbn = normalizeIsbn(raw)
  if (!/^97[89]\d{10}$/.test(isbn)) return false
  const digits = [...isbn].map(Number)
  const sum = digits.slice(0, 12).reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 1 : 3), 0)
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === digits[12]
}

/**
 * UI-CAT-1: muestra el ISBN con guiones usando una máscara fija 3-2-3-4-1
 * (la del ejemplo de la spec: 978-84-376-0494-7). La segmentación oficial depende
 * de tablas de rangos de la Agencia ISBN y queda fuera de alcance.
 */
export function formatIsbn(normalized: string): string {
  const match = /^(\d{3})(\d{2})(\d{3})(\d{4})(\d)$/.exec(normalized)
  return match ? match.slice(1).join('-') : normalized
}
