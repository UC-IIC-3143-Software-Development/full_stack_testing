import { expect, test } from '../fixtures'
import { searchLoans } from '../support/ui'

test('[UI-LOAN-2] "Mis préstamos" con un préstamo de cada estado', async ({ page }) => {
  await page.goto('/prestamos')
  await searchLoans(page, 'carla@uc.cl')
  await expect(page).toHaveScreenshot('mis-prestamos.png', { fullPage: true })
})
