import { defineConfig } from 'vitest/config'

// Config mínima para Stryker: solo los tests del dominio (funciones puras, sin jsdom ni MSW).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    env: { TZ: 'UTC' },
    include: ['src/shared/domain/**/*.test.ts'],
  },
})
