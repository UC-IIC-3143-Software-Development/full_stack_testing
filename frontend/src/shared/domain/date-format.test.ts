import { describe, expect, it } from 'vitest'
import { formatDate } from './date-format'

// En marzo Chile continental usa UTC-3 y en julio UTC-4. Los límites están en la medianoche local.
describe('formatDate', () => {
  it('[UI-LOAN-1] muestra la fecha de devolución como dd-mm-aaaa', () => {
    expect(formatDate('2026-03-16T12:00:00.000Z')).toBe('16-03-2026')
  })

  it('[UI-LOAN-1] usa la hora de Santiago: 02:59 UTC todavía es el día anterior', () => {
    expect(formatDate('2026-03-16T02:59:59.000Z')).toBe('15-03-2026')
    expect(formatDate('2026-03-16T03:00:00.000Z')).toBe('16-03-2026')
  })

  it('[UI-LOAN-1] respeta el horario de invierno (UTC-4)', () => {
    expect(formatDate('2026-07-01T03:30:00.000Z')).toBe('30-06-2026')
    expect(formatDate('2026-07-01T04:00:00.000Z')).toBe('01-07-2026')
  })
})
