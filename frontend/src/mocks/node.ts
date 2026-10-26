// Mock server en Node para Vitest: mismos handlers que el navegador, estado en memoria
// y reloj fijo (2026-03-02T12:00:00Z) para que los estados de préstamo sean deterministas.
import { setupServer } from 'msw/node'
import { createMemoryStore } from './db'
import { FIXED_NOW } from './fixtures'
import { createHandlers } from './handlers'

export const mockStore = createMemoryStore()

export const server = setupServer(...createHandlers(mockStore, { now: () => new Date(FIXED_NOW) }))
