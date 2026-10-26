import type { Page } from '@playwright/test'

/** Fecha fija de las pruebas (specs/flows/README.md). */
export const FIXED_NOW = new Date('2026-03-02T12:00:00.000Z')

/**
 * Fixture que reemplaza `page`: Date.now() y new Date() devuelven siempre FIXED_NOW,
 * pero los timers siguen corriendo (React y Next funcionan normal).
 */
export async function fixedClockPage({ page }: { page: Page }, use: (page: Page) => Promise<void>) {
  await page.clock.setFixedTime(FIXED_NOW)
  await use(page)
}
