// Hook genérico de lectura: estado de carga, error y recarga silenciosa.
// Mantiene los datos anteriores mientras recarga (no parpadea la pantalla).
import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { toApiFailure, type ApiFailure } from './problem'

export type QueryState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'success'
      data: T
    }
  | {
      status: 'error'
      failure: ApiFailure
    }

interface ApiResult<T> {
  data?: T
  error?: unknown
}

interface CacheEntry<T> {
  key: string
  state: QueryState<T>
}

export function useApiQuery<T>(key: string | null, fetcher: () => Promise<ApiResult<T>>) {
  const [entry, setEntry] = useState<CacheEntry<T> | null>(null)
  const [version, setVersion] = useState(0)
  const runFetcher = useEffectEvent(fetcher)

  useEffect(() => {
    if (key === null) return
    let active = true
    runFetcher()
      .then(({ data, error }) => {
        if (!active) return
        const state: QueryState<T> =
          data !== undefined
            ? { status: 'success', data }
            : { status: 'error', failure: toApiFailure(error) }
        setEntry({ key, state })
      })
      .catch((error: unknown) => {
        if (active) setEntry({ key, state: { status: 'error', failure: toApiFailure(error) } })
      })
    return () => {
      active = false
    }
  }, [key, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  let state: QueryState<T> = { status: 'loading' }
  if (key === null) state = { status: 'idle' }
  else if (entry?.key === key) state = entry.state

  return { state, reload }
}
