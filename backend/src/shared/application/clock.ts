/**
 * Puerto del reloj. Ningún caso de uso llama a `new Date()` o `Date.now()` directo:
 * así los tests usan un reloj fijo y las fechas son oráculos literales.
 */
export interface Clock {
  now(): Date
}

export const CLOCK = Symbol('Clock')
