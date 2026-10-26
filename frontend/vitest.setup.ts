// Configuración común de los tests de componentes: matchers de jest-dom y mock server.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { mockStore, server } from './src/mocks/node'

// Un /api sin handler es un error: así un test no puede pasar por accidente.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
// P4.5 Independencia: cada test parte con la "base de datos" sembrada desde cero.
beforeEach(() => mockStore.reset())
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
