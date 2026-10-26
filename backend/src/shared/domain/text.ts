/**
 * Normaliza un texto para buscar sin distinguir mayúsculas ni tildes (BOOK-R5).
 * "García Márquez" y "garcia marquez" producen la misma clave.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Largo en caracteres visibles (puntos de código), igual que cuentan JSON Schema y PostgreSQL. */
export function lengthInCodePoints(text: string): number {
  return Array.from(text).length
}
