// Fixtures de los flujos BDD (playwright-bdd): reloj fijo y capturas de evidencia para el PR.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createBdd, test as base } from 'playwright-bdd'
import { fixedClockPage } from '../support/clock'

const SCREENSHOTS_DIR = path.join(process.cwd(), 'evidence', 'screenshots')

interface Evidence {
  /** Guarda evidence/screenshots/<FLOW-ID>-<n>-<paso>.png y la adjunta al reporte HTML. */
  capture(stepTitle: string): Promise<void>
}

function slug(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '')
}

export const test = base.extend<{ evidence: Evidence }>({
  page: fixedClockPage,
  evidence: async ({ page }, use, testInfo) => {
    // El ID del flujo viene del tag del escenario en el .feature (@FLOW-PRE-01).
    const flowId = testInfo.tags.find((tag) => tag.startsWith('@FLOW-'))?.slice(1) ?? 'SIN-ID'
    let counter = 0
    mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    await use({
      async capture(stepTitle) {
        counter += 1
        const name = `${flowId}-${counter}-${slug(stepTitle)}.png`
        const file = path.join(SCREENSHOTS_DIR, name)
        await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' })
        await testInfo.attach(name, { path: file, contentType: 'image/png' })
      },
    })
  },
})

export const { Given, When, Then, AfterStep } = createBdd(test)

// Una captura después de cada paso: la secuencia cuenta el flujo en el comentario del PR.
AfterStep(async ({ evidence, $step }) => {
  await evidence.capture($step.title)
})
