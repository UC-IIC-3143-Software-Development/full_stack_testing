// Datos de prueba de specs/flows/README.md. Los usan el mock server (MSW) y los tests.
import type { Book, Loan } from '@/shared/api/types'

/** Reloj fijo de las pruebas (specs/flows/README.md). */
export const FIXED_NOW = '2026-03-02T12:00:00.000Z'

export const BOOK_IDS = {
  cienAnos: '6f1c2a9e-8b7d-4c6e-9f10-000000000001',
  desolacion: '6f1c2a9e-8b7d-4c6e-9f10-000000000002',
  ficciones: '6f1c2a9e-8b7d-4c6e-9f10-000000000003',
  casaEspiritus: '6f1c2a9e-8b7d-4c6e-9f10-000000000004',
  pedroParamo: '6f1c2a9e-8b7d-4c6e-9f10-000000000005',
  veintePoemas: '6f1c2a9e-8b7d-4c6e-9f10-000000000006',
} as const

/** Un préstamo guardado: el estado no se guarda, se calcula (LOAN-R6). */
export type StoredLoan = Omit<Loan, 'status'>

export interface MockState {
  books: Book[]
  loans: StoredLoan[]
}

const createdAt = '2026-01-05T12:00:00.000Z'

function book(
  id: string,
  title: string,
  author: string,
  isbn: string,
  totalCopies: number,
  availableCopies: number,
): Book {
  return { id, isbn, title, author, totalCopies, availableCopies, createdAt }
}

/**
 * Estado inicial. "carla@uc.cl" explica las copias que faltan en Ficciones y en
 * La casa de los espíritus, y tiene un préstamo de cada estado para "Mis préstamos".
 */
export function createSeedState(): MockState {
  return {
    books: [
      book(
        BOOK_IDS.cienAnos,
        'Cien años de soledad',
        'Gabriel García Márquez',
        '9780307474728',
        3,
        3,
      ),
      book(BOOK_IDS.desolacion, 'Desolación', 'Gabriela Mistral', '9789561112087', 1, 1),
      book(BOOK_IDS.ficciones, 'Ficciones', 'Jorge Luis Borges', '9788445067314', 2, 1),
      book(
        BOOK_IDS.casaEspiritus,
        'La casa de los espíritus',
        'Isabel Allende',
        '9780063376779',
        1,
        0,
      ),
      book(BOOK_IDS.pedroParamo, 'Pedro Páramo', 'Juan Rulfo', '9786073105484', 2, 2),
      book(
        BOOK_IDS.veintePoemas,
        'Veinte poemas de amor y una canción desesperada',
        'Pablo Neruda',
        '9789562390910',
        2,
        2,
      ),
    ],
    loans: [
      {
        id: '0a7d3b52-1c4e-4f8a-9b6d-000000000101',
        bookId: BOOK_IDS.ficciones,
        bookTitle: 'Ficciones',
        borrowerEmail: 'carla@uc.cl',
        loanedAt: '2026-02-01T15:00:00.000Z',
        dueAt: '2026-02-15T15:00:00.000Z',
        returnedAt: null,
        renewalCount: 0,
      },
      {
        id: '0a7d3b52-1c4e-4f8a-9b6d-000000000102',
        bookId: BOOK_IDS.casaEspiritus,
        bookTitle: 'La casa de los espíritus',
        borrowerEmail: 'carla@uc.cl',
        loanedAt: '2026-02-20T14:00:00.000Z',
        dueAt: '2026-03-06T14:00:00.000Z',
        returnedAt: null,
        renewalCount: 0,
      },
      {
        id: '0a7d3b52-1c4e-4f8a-9b6d-000000000103',
        bookId: BOOK_IDS.pedroParamo,
        bookTitle: 'Pedro Páramo',
        borrowerEmail: 'carla@uc.cl',
        loanedAt: '2026-01-05T13:00:00.000Z',
        dueAt: '2026-01-19T13:00:00.000Z',
        returnedAt: '2026-01-15T16:30:00.000Z',
        renewalCount: 0,
      },
    ],
  }
}
