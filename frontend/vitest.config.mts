import { defineConfig } from 'vitest/config'

// Dos proyectos:
//  unit      dominio puro y componentes (jsdom + Testing Library + MSW en Node)
//  contract  los handlers de MSW contra specs/api/openapi.yaml (Node puro)
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // La máquina de CI está en UTC y la de un estudiante quizás en Santiago: fijamos UTC
    // para que el formato de fechas en hora de Chile se pruebe de verdad.
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'reports/coverage',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Se mide el código que se publica. Las rutas (app) y el provider de MSW se cubren con
      // Playwright, y los mocks son infraestructura de pruebas (su contrato lo valida test:contract).
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/shared/api/schema.d.ts',
        'src/app/**',
        'src/providers/**',
        'src/mocks/**',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.contract.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'contract',
          environment: 'node',
          include: ['src/**/*.contract.test.ts'],
        },
      },
    ],
  },
})
