// Localizadores compartidos. Se basan en roles accesibles, como los usaría una persona.
import { expect, type Page } from '@playwright/test'

/** Tarjeta de un libro: <article> cuyo nombre accesible es el título. */
export function bookCard(page: Page, title: string) {
  return page.getByRole('article', { name: title, exact: true })
}

/** Insignia de disponibilidad dentro de una tarjeta (no tiene rol, se busca por texto). */
export function availabilityBadge(page: Page, title: string) {
  return bookCard(page, title).getByText(/^(Disponible \(\d+\)|Agotado)$/)
}

/** Un préstamo de "Mis préstamos": el ítem de lista que contiene el título del libro. */
export function loanItem(page: Page, title: string) {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) })
}

export async function openCatalog(page: Page) {
  await page.goto('/')
  // Con MSW la app se muestra recién cuando el worker está listo: esperamos la grilla.
  await expect(page.getByRole('list', { name: 'Libros del catálogo' })).toBeVisible()
}

export async function searchLoans(page: Page, email: string) {
  await page.getByLabel('Correo').fill(email)
  await page.getByRole('button', { name: 'Buscar préstamos' }).click()
  await expect(page.getByRole('heading', { name: `Préstamos de ${email}` })).toBeVisible()
}
