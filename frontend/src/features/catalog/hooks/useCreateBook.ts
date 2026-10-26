import { useState } from 'react'
import { apiClient } from '@/shared/api/client'
import { toApiFailure, type ApiFailure } from '@/shared/api/problem'
import type { Book, NewBook } from '@/shared/api/types'

export type CreateBookResult =
  | {
      ok: true
      book: Book
    }
  | {
      ok: false
      failure: ApiFailure
    }

/** Agrega un libro (createBook) y expone si hay una solicitud en curso. */
export function useCreateBook() {
  const [pending, setPending] = useState(false)

  async function createBook(input: NewBook): Promise<CreateBookResult> {
    setPending(true)
    try {
      const { data, error } = await apiClient.POST('/api/books', { body: input })
      return data ? { ok: true, book: data } : { ok: false, failure: toApiFailure(error) }
    } catch (error) {
      return { ok: false, failure: toApiFailure(error) }
    } finally {
      setPending(false)
    }
  }

  return { createBook, pending }
}
