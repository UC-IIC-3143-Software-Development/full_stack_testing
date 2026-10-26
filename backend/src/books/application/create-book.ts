import { randomUUID } from 'node:crypto'
import type { Clock } from '../../shared/application/clock'
import { Book } from '../domain/book'
import type { BookRepository } from './book.repository'

export interface CreateBookCommand {
  isbn: string
  title: string
  author: string
  totalCopies: number
}

/** Caso de uso: agregar un libro al catálogo (SPEC-LIB-01). */
export class CreateBook {
  constructor(
    private readonly books: BookRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateBookCommand): Promise<Book> {
    // BOOK-R1, BOOK-R3 y BOOK-R4 se validan en el dominio.
    const book = Book.create({ id: randomUUID(), ...command, now: this.clock.now() })

    // BOOK-R2: el puerto garantiza que add() rechaza un ISBN repetido (en PostgreSQL lo
    // decide el índice único, incluso con dos solicitudes simultáneas). Un "findByIsbn"
    // previo sería redundante: Stryker lo mostró como un mutante equivalente.
    await this.books.add(book)
    return book
  }
}
