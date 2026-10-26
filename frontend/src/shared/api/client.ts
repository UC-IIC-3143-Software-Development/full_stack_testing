// Cliente HTTP tipado generado desde el contrato (P2). Es la única puerta a la red
// del frontend: los componentes no llaman fetch directo (ARCH-R7).
import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Las rutas del contrato ya incluyen /api, así que la base es el mismo origen.
// En el navegador eso es relativo al sitio (Next reescribe /api hacia el backend).
// En Vitest (jsdom) window.location.origin es http://localhost:3000.
const baseUrl = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin

export const apiClient = createClient<paths>({
  baseUrl,
  // Se resuelve fetch en cada llamada (y no al crear el cliente) para que MSW en Node,
  // que reemplaza globalThis.fetch al iniciar, pueda interceptar las solicitudes.
  fetch: (request) => globalThis.fetch(request),
})
