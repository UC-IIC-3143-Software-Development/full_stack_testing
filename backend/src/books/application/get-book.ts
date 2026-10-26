import type { Book } from '../domain/book'
import { BookNotFoundError } from '../domain/book.errors'
import type { BookRepository } from './book.repository'

/** Caso de uso: obtener un libro por id (BOOK-R6). */
export class GetBook {
  constructor(private readonly books: BookRepository) {}

  async execute(bookId: string): Promise<Book> {
    const book = await this.books.findById(bookId)
    if (!book) {
      throw new BookNotFoundError(bookId)
    }
    return book
  }
}
