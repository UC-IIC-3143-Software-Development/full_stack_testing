// Regresión visual: compara contra imágenes de referencia generadas en Linux dentro de la
// imagen Docker de Playwright (fuentes y render idénticos a CI). En macOS se omiten.
import { expect, test } from '../fixtures'
import { bookCard, openCatalog } from '../support/ui'

test('[UI-CAT-4] catálogo completo en escritorio', async ({ page }) => {
  await openCatalog(page)
  await expect(page).toHaveScreenshot('catalogo-escritorio.png', { fullPage: true })
})

test('[UI-CAT-2] tarjeta de un libro disponible', async ({ page }) => {
  await openCatalog(page)
  await expect(bookCard(page, 'Cien años de soledad')).toHaveScreenshot('tarjeta-disponible.png')
})

test('[UI-CAT-2] tarjeta de un libro agotado', async ({ page }) => {
  await openCatalog(page)
  await expect(bookCard(page, 'La casa de los espíritus')).toHaveScreenshot('tarjeta-agotada.png')
})

test('[UI-CAT-7] catálogo con solo disponibles', async ({ page }) => {
  await openCatalog(page)
  await page.getByRole('checkbox', { name: 'Solo disponibles', exact: true }).check()
  await expect(bookCard(page, 'La casa de los espíritus')).toHaveCount(0)
  await expect(page).toHaveScreenshot('catalogo-solo-disponibles.png', { fullPage: true })
})
