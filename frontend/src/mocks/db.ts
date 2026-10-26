// "Base de datos" del mock server. Es un fake en memoria, no un mock (P4.3).
import { createSeedState, type MockState } from './fixtures'

export interface MockStore {
  read(): MockState
  write(state: MockState): void
  reset(): void
}

/** Para Node (Vitest): vive en memoria y se reinicia antes de cada test. */
export function createMemoryStore(): MockStore {
  let state = createSeedState()
  return {
    read: () => state,
    write: (next) => {
      state = next
    },
    reset: () => {
      state = createSeedState()
    },
  }
}

/**
 * Para el navegador: guarda el estado en sessionStorage, así sobrevive a un
 * page.goto() dentro del mismo test. Cada contexto de Playwright parte limpio.
 */
export function createSessionStorageStore(key = 'biblioteca-uc:mock-db'): MockStore {
  return {
    read: () => {
      const raw = sessionStorage.getItem(key)
      return raw ? (JSON.parse(raw) as MockState) : createSeedState()
    },
    write: (state) => sessionStorage.setItem(key, JSON.stringify(state)),
    reset: () => sessionStorage.removeItem(key),
  }
}
