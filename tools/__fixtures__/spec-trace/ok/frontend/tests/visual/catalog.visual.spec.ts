import { expect, test } from '@playwright/test'

test.describe('catálogo visual', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('[UI-CAT-1][FLOW-CAT-01] captura de la grilla', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveScreenshot('catalogo.png')
  })
})
