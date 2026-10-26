// Mock server en el navegador: un Service Worker intercepta las solicitudes a /api.
// Solo se carga si NEXT_PUBLIC_API_MOCKING=enabled (ver src/providers/ApiMockingProvider.tsx).
import { setupWorker } from 'msw/browser'
import { createSessionStorageStore } from './db'
import { createHandlers } from './handlers'

export const worker = setupWorker(...createHandlers(createSessionStorageStore()))
