import type { Book } from '../domain/book'

/**
 * Puerto del repositorio de libros. Lo implementan TypeOrmBookRepository (PostgreSQL)
 * y InMemoryBookRepository (fake de los tests). Ambos pasan la misma suite de contrato:
 * test/repository-contract/book-repository.contract.ts
 */
export interface BookRepository {
  /** Guarda un libro nuevo. Lanza IsbnAlreadyExistsError si el ISBN ya existe (BOOK-R2). */
  add(book: Book): Promise<void>
  findById(id: string): Promise<Book | null>
  /** Filtra por título o autor sin tildes ni mayúsculas, ordenado por título (BOOK-R5). */
  search(query?: string): Promise<Book[]>
  /**
   * Descuenta una copia solo si quedan (LOAN-R1). Es atómico: con dos llamadas
   * simultáneas por la última copia, solo una devuelve true.
   */
  takeCopy(bookId: string): Promise<boolean>
  /** Suma una copia sin superar el total (LOAN-R5). Devuelve false si ya estaban todas. */
  releaseCopy(bookId: string): Promise<boolean>
}

export const BOOK_REPOSITORY = Symbol('BookRepository')
