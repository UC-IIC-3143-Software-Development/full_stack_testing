import { describe, expect, it } from 'vitest'
import { presentLoanStatus } from './loan-status'

// El cálculo del estado (incluido el límite exacto de dueAt) se prueba en el backend, que es
// donde vive la regla. Aquí solo se prueba cómo se muestra cada estado: sin duplicar tests.
describe('presentLoanStatus', () => {
  it('[LOAN-R6] cada estado tiene su etiqueta en español y su token de color', () => {
    expect([
      presentLoanStatus('ACTIVE'),
      presentLoanStatus('OVERDUE'),
      presentLoanStatus('RETURNED'),
    ]).toEqual([
      { label: 'Activo', colorToken: '--color-info' },
      { label: 'Vencido', colorToken: '--color-danger' },
      { label: 'Devuelto', colorToken: '--color-muted' },
    ])
  })
})
