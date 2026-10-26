import type { Book } from '../domain/book'

/**
 * Tipos de entrada y salida HTTP. Son solo tipos de TypeScript: la validación real la hace
 * OpenApiValidationMiddleware contra specs/api/openapi.yaml (schemas NewBook y Book).
 */
export interface NewBookRequest {
  isbn: string
  title: string
  author: string
  totalCopies: number
}

export interface BookResponse {
  id: string
  isbn: string
  title: string
  author: string
  totalCopies: number
  availableCopies: number
  createdAt: string
}

export function toBookResponse(book: Book): BookResponse {
  return {
    id: book.id,
    isbn: book.isbn.value,
    title: book.title,
    author: book.author,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
    createdAt: book.createdAt.toISOString(),
  }
}
