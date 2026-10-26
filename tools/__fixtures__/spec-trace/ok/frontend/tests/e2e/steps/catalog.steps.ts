import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given('que estoy en el catálogo', async ({ page }) => {
  await page.goto('/')
})

When('busco {string}', async ({ page }, text: string) => {
  await page.getByRole('searchbox').fill(text)
})

Then('veo {int} libro(s)', async ({ page }, count: number) => {
  await page
    .getByRole('article')
    .nth(count - 1)
    .waitFor()
})
