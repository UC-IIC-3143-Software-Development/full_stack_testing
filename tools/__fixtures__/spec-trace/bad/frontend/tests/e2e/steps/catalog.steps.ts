import { createBdd } from 'playwright-bdd'

const { Given } = createBdd()

Given('que estoy en el catálogo', async ({ page }) => {
  await page.goto('/')
})
