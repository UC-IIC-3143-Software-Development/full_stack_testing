import { apiClient } from '@/shared/api/client'
import type { Book } from '@/shared/api/types'
import { useApiQuery } from '@/shared/api/use-api-query'

/** Lista o busca libros (listBooks). La API filtra sin tildes ni mayúsculas (BOOK-R5). */
export function useBooks(query: string) {
  const q = query.trim()
  return useApiQuery<Book[]>(`books?q=${q}`, () =>
    apiClient.GET('/api/books', { params: { query: q ? { q } : {} } }),
  )
}
