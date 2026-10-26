import type { Clock } from '../../application/clock'

/** Reloj real. Es el único lugar del backend donde se lee la hora del sistema. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
