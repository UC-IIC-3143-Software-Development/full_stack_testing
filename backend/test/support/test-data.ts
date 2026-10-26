import { Book } from '../../src/books/domain/book'
import { Email } from '../../src/loans/domain/email'
import { Loan } from '../../src/loans/domain/loan'

/** Reloj fijo de todas las pruebas (specs/flows/README.md). */
export const FIXED_NOW = '2026-03-02T12:00:00.000Z'

export interface BookSeed {
  title: string
  author: string
  isbn: string
}

/** Libros de specs/flows/README.md, con ISBN válidos. */
export const CATALOG = {
  cienAnos: {
    title: 'Cien años de soledad',
    author: 'Gabriel García Márquez',
    isbn: '9780307474728',
  },
  desolacion: { title: 'Desolación', author: 'Gabriela Mistral', isbn: '9789561112087' },
  ficciones: { title: 'Ficciones', author: 'Jorge Luis Borges', isbn: '9788445067314' },
  casaEspiritus: {
    title: 'La casa de los espíritus',
    author: 'Isabel Allende',
    isbn: '9780063376779',
  },
  pedroParamo: { title: 'Pedro Páramo', author: 'Juan Rulfo', isbn: '9786073105484' },
  veintePoemas: {
    title: 'Veinte poemas de amor y una canción desesperada',
    author: 'Pablo Neruda',
    isbn: '9789562390910',
  },
} satisfies Record<string, BookSeed>

let sequence = 0

/** Crea un Book válido del catálogo de prueba. Los ids son UUID válidos y únicos. */
export function aBook(entry: BookSeed, totalCopies = 1): Book {
  return Book.create({ id: nextUuid(), ...entry, totalCopies, now: new Date(FIXED_NOW) })
}

/** Crea un préstamo abierto del libro para el correo indicado. */
export function aLoan(book: Book, email: string, now: string = FIXED_NOW): Loan {
  return Loan.open({
    id: nextUuid(),
    bookId: book.id,
    bookTitle: book.title,
    borrowerEmail: Email.create(email),
    now: new Date(now),
  })
}

/** UUID v4 determinista: ...-4000-8000-<contador>. Facilita leer los fallos. */
export function nextUuid(): string {
  sequence += 1
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`
}
