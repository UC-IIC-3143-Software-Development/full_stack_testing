import type { Clock } from '../../application/clock'

/**
 * Reloj que siempre entrega la misma fecha (la fecha fija de prueba). Se usa en los tests y cuando
 * se define CLOCK_FIXED_NOW (evidencia del PR), para que "hoy" sea siempre el mismo instante,
 * por ejemplo 2026-03-02T12:00:00Z.
 */
export class FixedClock implements Clock {
  private current: Date

  constructor(now: Date | string) {
    const date = new Date(now)
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Fecha de prueba inválida: ${String(now)}`)
    }
    this.current = date
  }

  now(): Date {
    return new Date(this.current)
  }

  /** Avanza el reloj. Útil para probar préstamos vencidos (LOAN-R6). */
  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds)
  }
}
