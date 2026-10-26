import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js', 'solucion/tests/**/*.test.js'],
    exclude: process.env.SOLUCION ? ['tests/**'] : ['solucion/**'],
    setupFiles: ['tests/setup.js'],
    coverage: {
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
    },
  },
})
