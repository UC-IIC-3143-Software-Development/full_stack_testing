import { apiClient } from '@/shared/api/client'
import type { Book } from '@/shared/api/types'
import { useApiQuery } from '@/shared/api/use-api-query'

/** Obtiene un libro (getBook). reload() refresca las copias sin mostrar "Cargando". */
export function useBook(bookId: string) {
  return useApiQuery<Book>(`book:${bookId}`, () =>
    apiClient.GET('/api/books/{bookId}', { params: { path: { bookId } } }),
  )
}
