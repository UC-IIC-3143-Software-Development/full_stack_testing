// Accesibilidad automática con axe-core: cero violaciones WCAG 2.0/2.1 nivel A y AA.
// Detecta contraste insuficiente, campos sin label, roles inválidos, etc. No reemplaza
// la revisión manual con teclado y lector de pantalla.
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { BOOK_IDS } from '../../src/mocks/fixtures'
import { expect, test } from '../fixtures'
import { openCatalog, searchLoans } from '../support/ui'

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
  expect(summary).toEqual([])
}

test('[UI-CAT-1] el catálogo no tiene violaciones WCAG A/AA', async ({ page }) => {
  await openCatalog(page)
  await expectNoViolations(page)
})

test('[UI-CAT-5] el formulario "Agregar libro" con errores no tiene violaciones', async ({
  page,
}) => {
  await page.goto('/libros/nuevo')
  await page.getByLabel('ISBN').fill('123')
  await page.getByRole('button', { name: 'Guardar libro' }).click()
  await expect(page.getByText('El ISBN no es válido')).toBeVisible()
  await expectNoViolations(page)
})

test('[UI-LOAN-1] el detalle del libro con su formulario no tiene violaciones', async ({
  page,
}) => {
  await page.goto(`/libros/${BOOK_IDS.cienAnos}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Cien años de soledad' })).toBeVisible()
  await expectNoViolations(page)
})

test('[UI-LOAN-2] "Mis préstamos" con resultados no tiene violaciones', async ({ page }) => {
  await page.goto('/prestamos')
  await searchLoans(page, 'carla@uc.cl')
  await expectNoViolations(page)
})
