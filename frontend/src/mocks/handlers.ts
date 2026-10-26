// Mock server (MSW): implementa TODAS las operaciones de specs/api/openapi.yaml con las
// reglas mínimas para que el frontend se pueda probar sin backend. Sus respuestas se
// validan contra el contrato en handlers.contract.test.ts (lado consumidor del contrato).
import { http, HttpResponse, type HttpHandler } from 'msw'
import type { Book, ErrorCode, FieldError, Loan, Problem } from '@/shared/api/types'
import { isValidIsbn13, normalizeIsbn } from '@/shared/domain/isbn'
import { computeLoanStatus } from './loan-status'
import type { MockState, StoredLoan } from './fixtures'
import type { MockStore } from './db'

export interface HandlerOptions {
  /** Reloj inyectable: en Vitest es fijo, en el navegador lo fija Playwright (page.clock). */
  now?: () => Date
}

const LOAN_DAYS = 14
const MAX_ACTIVE_LOANS = 3
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const TITLES: Record<number, string> = { 400: 'Bad Request', 404: 'Not Found', 409: 'Conflict' }

function problem(status: number, code: ErrorCode, detail: string, errors?: FieldError[]) {
  const body: Problem = { type: 'about:blank', title: TITLES[status], status, code, detail }
  if (errors) body.errors = errors
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function validationError(errors: FieldError[]) {
  return problem(400, 'VALIDATION_ERROR', 'La solicitud tiene campos inválidos', errors)
}

/** BOOK-R5: compara sin mayúsculas ni tildes. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

function unexpectedFields(body: Record<string, unknown>, allowed: string[]): FieldError[] {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((field) => ({ field, message: 'Campo no permitido' }))
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function createHandlers(store: MockStore, options: HandlerOptions = {}): HttpHandler[] {
  const now = options.now ?? (() => new Date())

  const toLoan = (loan: StoredLoan): Loan => ({ ...loan, status: computeLoanStatus(loan, now()) })

  const findBook = (state: MockState, id: string) => state.books.find((b) => b.id === id)

  // El prefijo * hace que los handlers funcionen con cualquier origen
  // (navegador, jsdom y Node), porque el contrato define rutas que empiezan con /api.
  return [
    http.get('*/api/health', () => HttpResponse.json({ status: 'ok' })),

    http.get('*/api/books', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')
      if (q !== null && q.length > 100) {
        return validationError([{ field: 'q', message: 'La búsqueda admite hasta 100 caracteres' }])
      }
      const needle = fold(q ?? '')
      const books = store
        .read()
        .books.filter((b) => fold(b.title).includes(needle) || fold(b.author).includes(needle))
        .sort((a, b) => a.title.localeCompare(b.title, 'es'))
      return HttpResponse.json(books)
    }),

    http.post('*/api/books', async ({ request }) => {
      const body = await readJsonObject(request)
      if (!body)
        return validationError([{ field: 'body', message: 'El cuerpo debe ser un objeto JSON' }])

      const errors = unexpectedFields(body, ['isbn', 'title', 'author', 'totalCopies'])
      const { isbn, title, author, totalCopies } = body
      if (typeof isbn !== 'string' || !isValidIsbn13(isbn)) {
        errors.push({ field: 'isbn', message: 'El ISBN no es válido' })
      }
      const cleanTitle = typeof title === 'string' ? title.trim() : ''
      if (cleanTitle.length < 1 || cleanTitle.length > 200) {
        errors.push({ field: 'title', message: 'El título debe tener entre 1 y 200 caracteres' })
      }
      const cleanAuthor = typeof author === 'string' ? author.trim() : ''
      if (cleanAuthor.length < 1 || cleanAuthor.length > 120) {
        errors.push({ field: 'author', message: 'El autor debe tener entre 1 y 120 caracteres' })
      }
      if (
        !Number.isInteger(totalCopies) ||
        (totalCopies as number) < 1 ||
        (totalCopies as number) > 50
      ) {
        errors.push({
          field: 'totalCopies',
          message: 'Las copias deben ser un entero entre 1 y 50',
        })
      }
      if (errors.length > 0) return validationError(errors)

      const state = store.read()
      const normalized = normalizeIsbn(isbn as string)
      if (state.books.some((b) => b.isbn === normalized)) {
        return problem(409, 'ISBN_ALREADY_EXISTS', `Ya existe un libro con el ISBN ${normalized}`)
      }
      const created: Book = {
        id: crypto.randomUUID(),
        isbn: normalized,
        title: cleanTitle,
        author: cleanAuthor,
        totalCopies: totalCopies as number,
        availableCopies: totalCopies as number,
        createdAt: now().toISOString(),
      }
      store.write({ ...state, books: [...state.books, created] })
      return HttpResponse.json(created, { status: 201 })
    }),

    http.get('*/api/books/:bookId', ({ params }) => {
      const bookId = String(params.bookId)
      if (!UUID.test(bookId)) {
        return validationError([{ field: 'bookId', message: 'El identificador no es válido' }])
      }
      const book = findBook(store.read(), bookId)
      return book
        ? HttpResponse.json(book)
        : problem(404, 'BOOK_NOT_FOUND', 'No existe el libro solicitado')
    }),

    http.get('*/api/loans', ({ request }) => {
      const email = normalizeEmail(new URL(request.url).searchParams.get('borrowerEmail'))
      if (!email) {
        return validationError([{ field: 'borrowerEmail', message: 'El correo no es válido' }])
      }
      const loans = store
        .read()
        .loans.filter((l) => l.borrowerEmail === email)
        .sort((a, b) => b.loanedAt.localeCompare(a.loanedAt))
        .map(toLoan)
      return HttpResponse.json(loans)
    }),

    http.post('*/api/loans', async ({ request }) => {
      const body = await readJsonObject(request)
      if (!body)
        return validationError([{ field: 'body', message: 'El cuerpo debe ser un objeto JSON' }])

      const errors = unexpectedFields(body, ['bookId', 'borrowerEmail'])
      const bookId = typeof body.bookId === 'string' && UUID.test(body.bookId) ? body.bookId : null
      if (!bookId) errors.push({ field: 'bookId', message: 'El identificador no es válido' })
      const email = normalizeEmail(body.borrowerEmail)
      if (!email) errors.push({ field: 'borrowerEmail', message: 'El correo no es válido' })
      if (errors.length > 0 || !bookId || !email) return validationError(errors)

      const state = store.read()
      const book = findBook(state, bookId)
      if (!book) return problem(404, 'BOOK_NOT_FOUND', 'No existe el libro solicitado')

      const notReturned = state.loans.filter(
        (l) => l.borrowerEmail === email && l.returnedAt === null,
      )
      if (notReturned.some((l) => l.bookId === bookId)) {
        return problem(409, 'DUPLICATE_LOAN', `${email} ya tiene prestado este libro`)
      }
      if (notReturned.length >= MAX_ACTIVE_LOANS) {
        return problem(409, 'LOAN_LIMIT_REACHED', `${email} ya tiene 3 préstamos activos`)
      }
      if (book.availableCopies === 0) {
        return problem(409, 'NO_COPIES_AVAILABLE', 'No quedan copias disponibles')
      }

      const loanedAt = now()
      const dueAt = new Date(loanedAt.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000)
      const loan: StoredLoan = {
        id: crypto.randomUUID(),
        bookId,
        bookTitle: book.title,
        borrowerEmail: email,
        loanedAt: loanedAt.toISOString(),
        dueAt: dueAt.toISOString(),
        returnedAt: null,
      }
      store.write({
        books: state.books.map((b) =>
          b.id === bookId ? { ...b, availableCopies: b.availableCopies - 1 } : b,
        ),
        loans: [...state.loans, loan],
      })
      return HttpResponse.json(toLoan(loan), { status: 201 })
    }),

    http.post('*/api/loans/:loanId/return', ({ params }) => {
      const loanId = String(params.loanId)
      if (!UUID.test(loanId)) {
        return validationError([{ field: 'loanId', message: 'El identificador no es válido' }])
      }
      const state = store.read()
      const loan = state.loans.find((l) => l.id === loanId)
      if (!loan) return problem(404, 'LOAN_NOT_FOUND', 'No existe el préstamo solicitado')
      if (loan.returnedAt !== null) {
        return problem(409, 'ALREADY_RETURNED', 'El préstamo ya fue devuelto')
      }
      const returned: StoredLoan = { ...loan, returnedAt: now().toISOString() }
      store.write({
        books: state.books.map((b) =>
          b.id === loan.bookId
            ? { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) }
            : b,
        ),
        loans: state.loans.map((l) => (l.id === loanId ? returned : l)),
      })
      return HttpResponse.json(toLoan(returned))
    }),
  ]
}
