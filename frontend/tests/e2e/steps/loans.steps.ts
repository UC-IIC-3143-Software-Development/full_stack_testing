// Pasos de specs/flows/prestamos.feature.
import { expect, type Page } from '@playwright/test'
import { Given, Then, When } from '../fixtures'
import { bookCard, loanItem, openCatalog, searchLoans } from '../../support/ui'

/**
 * Prepara el estado llamando a la API DESDE la página (fetch dentro de page.evaluate).
 * Así el mismo paso funciona contra MSW (el Service Worker intercepta) y contra el backend real.
 */
async function borrowThroughApi(page: Page, email: string, titles: string[]) {
  await openCatalog(page)
  const failures = await page.evaluate(
    async ({ email, titles }) => {
      const problems: string[] = []
      for (const title of titles) {
        const response = await fetch(`/api/books?q=${encodeURIComponent(title)}`)
        const books = (await response.json()) as Array<{
          id: string
          title: string
        }>
        const book = books.find((b) => b.title === title)
        if (!book) {
          problems.push(`${title}: no existe`)
          continue
        }
        const loan = await fetch('/api/loans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: book.id, borrowerEmail: email }),
        })
        if (loan.status !== 201) problems.push(`${title}: ${loan.status}`)
      }
      return problems
    },
    { email, titles },
  )
  expect(failures).toEqual([])
  await page.reload()
}

Given('que {string} tiene prestado {string}', async ({ page }, email: string, title: string) => {
  await borrowThroughApi(page, email, [title])
})

Given(
  'que {string} tiene prestados {string}, {string} y {string}',
  async ({ page }, email: string, first: string, second: string, third: string) => {
    await borrowThroughApi(page, email, [first, second, third])
  },
)

When(
  'pido prestado {string} con el correo {string}',
  async ({ page }, title: string, email: string) => {
    if (new URL(page.url()).pathname !== '/') await openCatalog(page)
    await bookCard(page, title)
      .getByRole('link', { name: /pedir prestado/i })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await page.getByLabel('Correo').fill(email)
    await page.getByRole('button', { name: 'Pedir prestado', exact: true }).click()
  },
)

Then('veo la fecha de devolución {string}', async ({ page }, date: string) => {
  await expect(page.getByRole('status')).toContainText(`Fecha de devolución: ${date}`)
})

When('reviso los préstamos de {string}', async ({ page }, email: string) => {
  await page.getByRole('link', { name: 'Mis préstamos' }).click()
  await searchLoans(page, email)
})

When('devuelvo {string}', async ({ page }, title: string) => {
  await loanItem(page, title)
    .getByRole('button', { name: /devolver/i })
    .click()
})

Then(
  'el préstamo de {string} aparece como {string}',
  async ({ page }, title: string, status: string) => {
    await expect(loanItem(page, title).getByText(status, { exact: true })).toBeVisible()
  },
)
