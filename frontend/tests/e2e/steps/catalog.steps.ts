// Pasos de specs/flows/catalogo.feature. Una sola implementación por paso (en español).
import { expect } from '@playwright/test'
import { Given, Then, When } from '../fixtures'
import { availabilityBadge, bookCard, openCatalog } from '../../support/ui'

Given('que estoy en el catálogo', async ({ page }) => {
  await openCatalog(page)
})

When('busco {string}', async ({ page }, text: string) => {
  await page.getByLabel('Buscar por título o autor').fill(text)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
})

Then('veo el libro {string}', async ({ page }, title: string) => {
  await expect(bookCard(page, title)).toBeVisible()
})

Then('el libro {string} aparece como {string}', async ({ page }, title: string, badge: string) => {
  await expect(availabilityBadge(page, title)).toHaveText(badge)
})

Then('no puedo pedir prestado {string}', async ({ page }, title: string) => {
  await expect(
    bookCard(page, title).getByRole('button', { name: /pedir prestado/i }),
  ).toBeDisabled()
})

When(
  'agrego el libro {string} de {string} con ISBN {string} y {int} copias',
  async ({ page }, title: string, author: string, isbn: string, copies: number) => {
    await page.getByRole('link', { name: 'Agregar libro' }).click()
    await page.getByLabel('ISBN').fill(isbn)
    await page.getByLabel('Título').fill(title)
    await page.getByLabel('Autor').fill(author)
    await page.getByLabel('Copias').fill(String(copies))
    await page.getByRole('button', { name: 'Guardar libro' }).click()
  },
)

Then('veo el mensaje {string}', async ({ page }, message: string) => {
  await expect(page.getByRole('status').filter({ hasText: message })).toBeVisible()
})

Then('veo el error {string}', async ({ page }, message: string) => {
  await expect(page.getByText(message, { exact: true })).toBeVisible()
})
