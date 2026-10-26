import type { BookRepository } from '../../src/books/application/book.repository'
import { Book } from '../../src/books/domain/book'
import { IsbnAlreadyExistsError } from '../../src/books/domain/book.errors'
import { normalizeForSearch } from '../../src/shared/domain/text'
import type { Snapshottable } from './in-memory-unit-of-work'

/**
 * Fake en memoria del repositorio de libros. No es un mock: tiene comportamiento real
 * y pasa la misma suite de contrato que el repositorio de PostgreSQL.
 */
export class InMemoryBookRepository implements BookRepository, Snapshottable {
  private books = new Map<string, Book>()

  async add(book: Book): Promise<void> {
    if (this.all().some((existing) => existing.isbn.equals(book.isbn))) {
      throw new IsbnAlreadyExistsError(book.isbn.value)
    }
    this.books.set(book.id, book)
  }

  async findById(id: string): Promise<Book | null> {
    return this.books.get(id) ?? null
  }

  async search(query?: string): Promise<Book[]> {
    const key = normalizeForSearch(query ?? '')
    return this.all()
      .filter((book) => key === '' || book.searchKey.includes(key))
      .sort((a, b) => compare(a.titleKey, b.titleKey) || compare(a.id, b.id))
  }

  async takeCopy(bookId: string): Promise<boolean> {
    const book = this.books.get(bookId)
    if (!book || book.availableCopies === 0) return false
    this.books.set(bookId, withAvailableCopies(book, book.availableCopies - 1))
    return true
  }

  async releaseCopy(bookId: string): Promise<boolean> {
    const book = this.books.get(bookId)
    if (!book || book.availableCopies >= book.totalCopies) return false
    this.books.set(bookId, withAvailableCopies(book, book.availableCopies + 1))
    return true
  }

  snapshot(): Map<string, Book> {
    return new Map(this.books)
  }

  restore(snapshot: unknown): void {
    this.books = new Map(snapshot as Map<string, Book>)
  }

  private all(): Book[] {
    return [...this.books.values()]
  }
}

/** Mismo orden que COLLATE "C" en PostgreSQL: compara por código de carácter. */
function compare(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

function withAvailableCopies(book: Book, availableCopies: number): Book {
  return Book.restore({
    id: book.id,
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    totalCopies: book.totalCopies,
    availableCopies,
    createdAt: book.createdAt,
  })
}
