import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

// Dos modos:
//  - test:e2e        Next + MSW en el navegador (sin backend). Todos los proyectos.
//  - test:e2e:smoke  E2E_BASE_URL apunta al stack real (frontend + backend + PostgreSQL).
//                    No levanta servidor y corre solo los escenarios @smoke.
const port = Number(process.env.E2E_PORT ?? 3000)
const externalBaseUrl = process.env.E2E_BASE_URL
const baseURL = externalBaseUrl ?? `http://localhost:${port}`
const target = process.env.E2E_TARGET ?? (externalBaseUrl ? 'fullstack' : 'mock')
const isCI = Boolean(process.env.CI)

// Los flujos de specs/flows/*.feature se convierten en tests (npx bddgen): la spec ES el test.
const flowsDir = defineBddConfig({
  features: '../specs/flows/*.feature',
  featuresRoot: '../specs/flows',
  steps: ['tests/e2e/fixtures.ts', 'tests/e2e/steps/*.ts'],
  outputDir: '.features-gen',
  language: 'es',
  missingSteps: 'fail-on-gen',
})

const desktop = devices['Desktop Chrome']

export default defineConfig({
  outputDir: 'test-results',
  fullyParallel: target === 'mock',
  workers: target === 'mock' ? undefined : 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'reports/playwright.json' }],
  ],
  // Las imágenes de referencia son de Linux (imagen Docker de Playwright). En otro SO se omiten.
  ignoreSnapshots: process.platform !== 'linux',
  // Tolerancia absoluta y estricta: las capturas se generan y comparan en la misma imagen Docker,
  // así que no hay ruido de fuentes. Con maxDiffPixelRatio 0.01 (1 % de una página de 1280x800,
  // unos 10.000 píxeles) el botón "Renovar" de SPEC-LIB-03 pasaba sin que el test lo notara.
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 25 },
  },
  globalSetup: target === 'fullstack' ? './tests/e2e/global-setup.ts' : undefined,
  use: {
    baseURL,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'flows',
      testDir: flowsDir,
      use: {
        ...desktop,
        viewport: { width: 960, height: 600 },
        video: { mode: 'on', size: { width: 960, height: 600 } },
      },
    },
    {
      name: 'visual',
      testDir: 'tests/visual',
      testMatch: '*.visual.spec.ts',
      snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
      use: { ...desktop, viewport: { width: 1280, height: 800 } },
    },
    { name: 'style', testDir: 'tests/style', testMatch: '*.style.spec.ts', use: desktop },
    { name: 'layout', testDir: 'tests/layout', testMatch: '*.layout.spec.ts', use: desktop },
    { name: 'a11y', testDir: 'tests/a11y', testMatch: '*.a11y.spec.ts', use: desktop },
    // Cross-browser solo en el nightly (E2E_CROSS_BROWSER=1): en cada PR basta con Chromium.
    ...(process.env.E2E_CROSS_BROWSER
      ? [
          { name: 'flows-firefox', testDir: flowsDir, use: { ...devices['Desktop Firefox'] } },
          { name: 'flows-webkit', testDir: flowsDir, use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run build:mock && npm run start',
        env: { PORT: String(port) },
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 240_000,
      },
})
