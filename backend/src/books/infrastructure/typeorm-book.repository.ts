import { Injectable } from '@nestjs/common'
import { normalizeForSearch } from '../../shared/domain/text'
import { isUniqueViolation } from '../../shared/infrastructure/database/postgres-errors'
import { TypeOrmUnitOfWork } from '../../shared/infrastructure/database/typeorm-unit-of-work'
import type { BookRepository } from '../application/book.repository'
import { Book } from '../domain/book'
import { IsbnAlreadyExistsError } from '../domain/book.errors'
import { Isbn } from '../domain/isbn'
import { BookOrmEntity } from './book.orm-entity'

/** Nombre del índice único creado en la migración (BOOK-R2). */
export const BOOKS_ISBN_UNIQUE = 'uq_books_isbn'

@Injectable()
export class TypeOrmBookRepository implements BookRepository {
  constructor(private readonly unitOfWork: TypeOrmUnitOfWork) {}

  private get repository() {
    return this.unitOfWork.manager().getRepository(BookOrmEntity)
  }

  async add(book: Book): Promise<void> {
    try {
      await this.repository.insert(toRow(book))
    } catch (error) {
      if (isUniqueViolation(error, BOOKS_ISBN_UNIQUE)) {
        throw new IsbnAlreadyExistsError(book.isbn.value)
      }
      throw error
    }
  }

  async findById(id: string): Promise<Book | null> {
    const row = await this.repository.findOneBy({ id })
    return row ? toDomain(row) : null
  }

  async search(query?: string): Promise<Book[]> {
    const builder = this.repository
      .createQueryBuilder('book')
      .orderBy('book.title_key', 'ASC')
      .addOrderBy('book.id', 'ASC')
    const key = normalizeForSearch(query ?? '')
    if (key) {
      // La clave ya viene sin tildes ni mayúsculas desde el dominio (BOOK-R5).
      // Se escapan % y _ para que se busquen como texto y no como comodines.
      builder.where("book.search_key LIKE :pattern ESCAPE '\\'", {
        pattern: `%${escapeLike(key)}%`,
      })
    }
    const rows = await builder.getMany()
    return rows.map(toDomain)
  }

  async takeCopy(bookId: string): Promise<boolean> {
    // LOAN-R1: UPDATE condicional. Si dos transacciones compiten por la última copia,
    // PostgreSQL bloquea la fila y la segunda vuelve a evaluar el WHERE: afecta 0 filas.
    const result = await this.repository
      .createQueryBuilder()
      .update(BookOrmEntity)
      .set({ availableCopies: () => 'available_copies - 1' })
      .where('id = :bookId AND available_copies > 0', { bookId })
      .execute()
    return result.affected === 1
  }

  async releaseCopy(bookId: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(BookOrmEntity)
      .set({ availableCopies: () => 'available_copies + 1' })
      .where('id = :bookId AND available_copies < total_copies', { bookId })
      .execute()
    return result.affected === 1
  }
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function toRow(book: Book): BookOrmEntity {
  return {
    id: book.id,
    isbn: book.isbn.value,
    title: book.title,
    author: book.author,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
    searchKey: book.searchKey,
    titleKey: book.titleKey,
    createdAt: book.createdAt,
  }
}

function toDomain(row: BookOrmEntity): Book {
  return Book.restore({
    id: row.id,
    isbn: Isbn.create(row.isbn),
    title: row.title,
    author: row.author,
    totalCopies: row.totalCopies,
    availableCopies: row.availableCopies,
    createdAt: row.createdAt,
  })
}
