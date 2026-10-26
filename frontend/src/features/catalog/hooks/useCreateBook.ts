import { useState } from 'react'
import { apiClient } from '@/shared/api/client'
import { fieldErrorsOf, toApiFailure, type ApiFailure } from '@/shared/api/problem'
import type { Book, NewBook } from '@/shared/api/types'

export type CreateBookResult =
  | {
      ok: true
      book: Book
    }
  | {
      ok: false
      failure: ApiFailure
      /** Errores por campo de un 400 (campo a mensaje), así el componente no importa shared/api. */
      fieldErrors: Record<string, string>
    }

function failed(error: unknown): CreateBookResult {
  const failure = toApiFailure(error)
  return { ok: false, failure, fieldErrors: fieldErrorsOf(failure) }
}

/** Agrega un libro (createBook) y expone si hay una solicitud en curso. */
export function useCreateBook() {
  const [pending, setPending] = useState(false)

  async function createBook(input: NewBook): Promise<CreateBookResult> {
    setPending(true)
    try {
      const { data, error } = await apiClient.POST('/api/books', { body: input })
      return data ? { ok: true, book: data } : failed(error)
    } catch (error) {
      return failed(error)
    } finally {
      setPending(false)
    }
  }

  return { createBook, pending }
}
