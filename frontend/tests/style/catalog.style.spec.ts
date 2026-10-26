// Detectan cambios de COLOR de forma determinista: comparan el estilo computado con los
// tokens de la spec. No usan imágenes, así que corren igual en macOS, Linux y Windows.
import { expect, test } from '../fixtures'
import { availabilityBadge, bookCard, openCatalog } from '../support/ui'

test.beforeEach(async ({ page }) => {
  await openCatalog(page)
})

test('[UI-CAT-2] la insignia "Disponible" es verde --color-success (#1E7F3C)', async ({ page }) => {
  const badge = availabilityBadge(page, 'Cien años de soledad')
  await expect(badge).toHaveText('Disponible (3)')
  await expect(badge).toHaveCSS('background-color', 'rgb(30, 127, 60)')
  await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)')
})

test('[UI-CAT-2] la insignia "Agotado" es roja --color-danger (#B42318)', async ({ page }) => {
  const badge = availabilityBadge(page, 'La casa de los espíritus')
  await expect(badge).toHaveText('Agotado')
  await expect(badge).toHaveCSS('background-color', 'rgb(180, 35, 24)')
})

test('[UI-CAT-3] el botón "Pedir prestado" deshabilitado se ve inactivo', async ({ page }) => {
  const button = bookCard(page, 'La casa de los espíritus').getByRole('button', {
    name: /pedir prestado/i,
  })
  await expect(button).toBeDisabled()
  await expect(button).toHaveCSS('background-color', 'rgb(228, 231, 236)')
  await expect(button).toHaveCSS('cursor', 'not-allowed')
})
