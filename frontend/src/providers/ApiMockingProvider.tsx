'use client'

// Activa el mock server (MSW) en el navegador SOLO si NEXT_PUBLIC_API_MOCKING=enabled.
// Vive fuera de app/ para respetar ARCH-R8: app no importa mocks. El import es dinámico,
// así el código de MSW ni siquiera se descarga cuando el mocking está apagado.
import { useEffect, useState, type ReactNode } from 'react'

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled'

let workerStarted: Promise<unknown> | null = null

function startWorker() {
  // Next reemplaza ambas expresiones al compilar. En el bundle del servidor y en el build
  // de producción (sin mocking) esta rama desaparece: el código de MSW no se publica.
  if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled' && typeof window !== 'undefined') {
    workerStarted ??= import('@/mocks/browser').then(({ worker }) =>
      worker.start({
        quiet: true,
        // Solo nos importan las rutas del contrato: un /api sin handler es un error.
        onUnhandledFrame: ({ frame, defaults }) => {
          const request = (frame.data as { request?: Request }).request
          if (request && new URL(request.url).pathname.startsWith('/api/')) defaults.error()
        },
      }),
    )
  }
  return workerStarted ?? Promise.resolve()
}

/** No muestra la app hasta que el worker está listo: evita carreras con el primer fetch. */
export function ApiMockingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!mockingEnabled)

  useEffect(() => {
    if (!mockingEnabled) return
    let active = true
    startWorker().then(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  return ready ? children : null
}
