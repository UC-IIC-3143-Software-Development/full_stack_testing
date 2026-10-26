import { expect, test } from '../fixtures'
import { loanItem, searchLoans } from '../support/ui'

// carla@uc.cl tiene un préstamo de cada estado en el mock server (src/mocks/fixtures.ts).
test.beforeEach(async ({ page }) => {
  await page.goto('/prestamos')
  await searchLoans(page, 'carla@uc.cl')
})

test('[UI-LOAN-2] la etiqueta "Activo" es azul --color-info (#1D4ED8)', async ({ page }) => {
  const label = loanItem(page, 'La casa de los espíritus').getByText('Activo', { exact: true })
  await expect(label).toHaveCSS('background-color', 'rgb(29, 78, 216)')
})

test('[UI-LOAN-2] la etiqueta "Vencido" es roja --color-danger (#B42318)', async ({ page }) => {
  const label = loanItem(page, 'Ficciones').getByText('Vencido', { exact: true })
  await expect(label).toHaveCSS('background-color', 'rgb(180, 35, 24)')
})

test('[UI-LOAN-2] la etiqueta "Devuelto" es gris --color-muted (#475467)', async ({ page }) => {
  const label = loanItem(page, 'Pedro Páramo').getByText('Devuelto', { exact: true })
  await expect(label).toHaveCSS('background-color', 'rgb(71, 84, 103)')
})
