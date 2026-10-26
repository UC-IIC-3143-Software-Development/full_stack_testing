import type { Book } from '../domain/book'
import type { BookRepository } from './book.repository'

/** Caso de uso: listar y buscar libros (BOOK-R5). */
export class ListBooks {
  constructor(private readonly books: BookRepository) {}

  execute(query?: string): Promise<Book[]> {
    return this.books.search(query)
  }
}
