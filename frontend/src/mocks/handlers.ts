// Mock server (MSW): implementa TODAS las operaciones de specs/api/openapi.yaml con las
// reglas mínimas para que el frontend se pueda probar sin backend. Sus respuestas se
// validan contra el contrato en handlers.contract.test.ts (lado consumidor del contrato).
import { http, HttpResponse, type HttpHandler } from 'msw'
import type {
  Book,
  ErrorCode,
  FieldError,
  Loan,
  Problem,
  RenewalErrorCode,
  RenewalProblem,
} from '@/shared/api/types'
import { isValidIsbn13, normalizeIsbn } from '@/shared/domain/isbn'
import { computeLoanStatus } from './loan-status'
import type { MockState, StoredLoan } from './fixtures'
import type { MockStore } from './db'

export interface HandlerOptions {
  /** Reloj inyectable: en Vitest es fijo, en el navegador lo fija Playwright (page.clock). */
  now?: () => Date
}

const DAY_MS = 24 * 60 * 60 * 1000
const LOAN_DAYS = 14
const MAX_ACTIVE_LOANS = 3
const RENEWAL_DAYS = 7
const MAX_RENEWALS = 1
const OVERDUE_DEFAULT_LIMIT = 20
const INTEGER = /^-?\d+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Mismo patrón que el formato email de ajv-formats, que usa el backend para validar el contrato.
// Es una copia exacta a propósito: si la simplificamos, el mock acepta o rechaza correos
// distintos que el backend. Por eso no se cumple el límite de sonarjs/regex-complexity (21 de 20).
const EMAIL =
  // eslint-disable-next-line sonarjs/regex-complexity -- copia exacta de ajv-formats
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i
const EMAIL_MAX_LENGTH = 254

// Textos de los 400 copiados del backend (openapi-request-validator.ts valida el contrato y
// el dominio valida BOOK-R1 y BOOK-R3). La UI muestra lo mismo con mock server o con backend.
const MESSAGES = {
  required: 'El campo es obligatorio',
  notAllowed: 'El campo no está permitido',
  text: 'Debe ser de tipo texto',
  integer: 'Debe ser de tipo número entero',
  email: 'Debe ser un correo válido',
  uuid: 'Debe ser un UUID válido',
  isbn: 'El ISBN no es válido',
  queryRequired: 'El parámetro es obligatorio',
  invalidJson: 'El cuerpo no es un JSON válido',
  notObject: 'Debe ser de tipo objeto',
  minLength: (limit: number) => `Debe tener al menos ${limit} caracteres`,
  maxLength: (limit: number) => `Debe tener como máximo ${limit} caracteres`,
  minimum: (limit: number) => `Debe ser mayor o igual a ${limit}`,
  maximum: (limit: number) => `Debe ser menor o igual a ${limit}`,
  blank: (label: string) => `${label} no puede estar vacío`,
}

const TITLES: Record<number, string> = { 400: 'Bad Request', 404: 'Not Found', 409: 'Conflict' }

function problem(status: number, code: ErrorCode, detail: string, errors?: FieldError[]) {
  const body: Problem = { type: 'about:blank', title: TITLES[status], status, code, detail }
  if (errors) body.errors = errors
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

/** 409 de renewLoan: el contrato le da su propio schema (RenewalProblem). */
function renewalProblem(code: RenewalErrorCode, detail: string) {
  const body: RenewalProblem = {
    type: 'about:blank',
    title: TITLES[409],
    status: 409,
    code,
    detail,
  }
  return HttpResponse.json(body, {
    status: 409,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function validationError(errors: FieldError[]) {
  return problem(400, 'VALIDATION_ERROR', 'La solicitud tiene campos inválidos', errors)
}

/** Largo en puntos de código, como cuentan JSON Schema (ajv) y el backend. */
function codePoints(text: string): number {
  return [...text].length
}

/** Valida un texto como lo hace el contrato: tipo, minLength y maxLength. */
function textError(value: unknown, min: number, max: number): string | null {
  if (value === undefined) return MESSAGES.required
  if (typeof value !== 'string') return MESSAGES.text
  if (codePoints(value) > max) return MESSAGES.maxLength(max)
  if (codePoints(value) < min) return MESSAGES.minLength(min)
  return null
}

/** Correo según el contrato (format email, maxLength 254). Se valida tal como llega, sin recortar. */
function emailError(value: unknown): string | null {
  if (value === undefined || value === null) return MESSAGES.required
  if (typeof value !== 'string') return MESSAGES.text
  if (value.length > EMAIL_MAX_LENGTH) return MESSAGES.maxLength(EMAIL_MAX_LENGTH)
  return EMAIL.test(value) ? null : MESSAGES.email
}

function uuidError(value: unknown): string | null {
  if (value === undefined) return MESSAGES.required
  if (typeof value !== 'string') return MESSAGES.text
  return UUID.test(value) ? null : MESSAGES.uuid
}

function copiesError(value: unknown): string | null {
  if (value === undefined) return MESSAGES.required
  if (!Number.isInteger(value)) return MESSAGES.integer
  if ((value as number) < 1) return MESSAGES.minimum(1)
  if ((value as number) > 50) return MESSAGES.maximum(50)
  return null
}

function collect(entries: [string, string | null][]): FieldError[] {
  return entries.flatMap(([field, message]) => (message ? [{ field, message }] : []))
}

/** BOOK-R5: compara sin mayúsculas ni tildes. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function unexpectedFields(body: Record<string, unknown>, allowed: string[]): FieldError[] {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((field) => ({ field, message: MESSAGES.notAllowed }))
}

/** Cuerpo JSON de la solicitud, o el FieldError que respondería el backend si no es un objeto. */
async function readJsonObject(
  request: Request,
): Promise<{ body: Record<string, unknown> } | { error: FieldError }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { error: { field: 'body', message: MESSAGES.invalidJson } }
  }
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? { body: body as Record<string, unknown> }
    : { error: { field: 'body', message: MESSAGES.notObject } }
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
      if (q !== null && codePoints(q) > 100) {
        return validationError([{ field: 'q', message: MESSAGES.maxLength(100) }])
      }
      const needle = fold(q ?? '')
      const books = store
        .read()
        .books.filter((b) => fold(b.title).includes(needle) || fold(b.author).includes(needle))
        .sort((a, b) => a.title.localeCompare(b.title, 'es'))
      return HttpResponse.json(books)
    }),

    http.post('*/api/books', async ({ request }) => {
      const parsed = await readJsonObject(request)
      if ('error' in parsed) return validationError([parsed.error])
      const { body } = parsed

      // Primero el contrato (todos los campos a la vez), como el validador del backend.
      const { isbn, title, author, totalCopies } = body
      const schemaErrors = [
        ...unexpectedFields(body, ['isbn', 'title', 'author', 'totalCopies']),
        ...collect([
          ['isbn', textError(isbn, 13, 17)],
          ['title', textError(title, 1, 200)],
          ['author', textError(author, 1, 120)],
          ['totalCopies', copiesError(totalCopies)],
        ]),
      ]
      if (schemaErrors.length > 0) return validationError(schemaErrors)

      // Después el dominio (BOOK-R1 y BOOK-R3), que responde solo el primer error.
      const cleanTitle = (title as string).trim()
      const cleanAuthor = (author as string).trim()
      if (!isValidIsbn13(isbn as string)) {
        return validationError([{ field: 'isbn', message: MESSAGES.isbn }])
      }
      if (cleanTitle.length === 0) {
        return validationError([{ field: 'title', message: MESSAGES.blank('El título') }])
      }
      if (cleanAuthor.length === 0) {
        return validationError([{ field: 'author', message: MESSAGES.blank('El autor') }])
      }

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
        return validationError([{ field: 'bookId', message: MESSAGES.uuid }])
      }
      const book = findBook(store.read(), bookId)
      return book
        ? HttpResponse.json(book)
        : problem(404, 'BOOK_NOT_FOUND', 'No existe el libro solicitado')
    }),

    http.get('*/api/loans', ({ request }) => {
      const raw = new URL(request.url).searchParams.get('borrowerEmail')
      const error = raw === null ? MESSAGES.queryRequired : emailError(raw)
      if (error) return validationError([{ field: 'borrowerEmail', message: error }])
      // LOAN-R7: se compara sin distinguir mayúsculas.
      const email = (raw as string).toLowerCase()
      const loans = store
        .read()
        .loans.filter((l) => l.borrowerEmail === email)
        .sort((a, b) => b.loanedAt.localeCompare(a.loanedAt))
        .map(toLoan)
      return HttpResponse.json(loans)
    }),

    // LOAN-R8: préstamos vencidos, del que venció hace más tiempo al más reciente.
    http.get('*/api/loans/overdue', ({ request }) => {
      const params = new URL(request.url).searchParams
      const raw = params.get('borrowerEmail')
      const rawLimit = params.get('limit')
      const errors = collect([
        ['borrowerEmail', raw === null ? null : emailError(raw)],
        ['limit', rawLimit === null || INTEGER.test(rawLimit) ? null : MESSAGES.integer],
      ])
      if (errors.length > 0) return validationError(errors)
      const email = raw?.toLowerCase()
      // El contrato no fija un mínimo para limit: el mock trata un valor negativo como 0.
      const limit = rawLimit === null ? OVERDUE_DEFAULT_LIMIT : Math.max(Number(rawLimit), 0)
      const loans = store
        .read()
        .loans.filter((l) => email === undefined || l.borrowerEmail === email)
        .map(toLoan)
        .filter((l) => l.status === 'OVERDUE')
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, limit)
      return HttpResponse.json(loans)
    }),

    http.post('*/api/loans', async ({ request }) => {
      const parsed = await readJsonObject(request)
      if ('error' in parsed) return validationError([parsed.error])
      const { body } = parsed

      const errors = [
        ...unexpectedFields(body, ['bookId', 'borrowerEmail']),
        ...collect([
          ['bookId', uuidError(body.bookId)],
          ['borrowerEmail', emailError(body.borrowerEmail)],
        ]),
      ]
      if (errors.length > 0) return validationError(errors)
      const bookId = body.bookId as string
      // LOAN-R7: el contrato ya rechazó los espacios, así que normalizar es pasar a minúsculas.
      const email = (body.borrowerEmail as string).toLowerCase()

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
      const dueAt = new Date(loanedAt.getTime() + LOAN_DAYS * DAY_MS)
      const loan: StoredLoan = {
        id: crypto.randomUUID(),
        bookId,
        bookTitle: book.title,
        borrowerEmail: email,
        loanedAt: loanedAt.toISOString(),
        dueAt: dueAt.toISOString(),
        returnedAt: null,
        renewalCount: 0,
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
        return validationError([{ field: 'loanId', message: MESSAGES.uuid }])
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

    // SPEC-LIB-03. Con varios conflictos a la vez, el orden es: devuelto (RENEW-R3),
    // ya renovado (RENEW-R2) y vencido (RENEW-R3).
    http.post('*/api/loans/:loanId/renew', ({ params }) => {
      const loanId = String(params.loanId)
      if (!UUID.test(loanId)) {
        return validationError([{ field: 'loanId', message: MESSAGES.uuid }])
      }
      const state = store.read()
      const loan = state.loans.find((l) => l.id === loanId)
      if (!loan) return problem(404, 'LOAN_NOT_FOUND', 'No existe el préstamo solicitado')
      if (loan.returnedAt !== null) {
        return renewalProblem('ALREADY_RETURNED', 'El préstamo ya fue devuelto')
      }
      if (loan.renewalCount >= MAX_RENEWALS) {
        return renewalProblem('RENEWAL_LIMIT_REACHED', 'El préstamo ya fue renovado')
      }
      // Renovar justo en el instante dueAt está permitido: computeLoanStatus usa "mayor que".
      if (computeLoanStatus(loan, now()) === 'OVERDUE') {
        return renewalProblem('LOAN_OVERDUE', 'El préstamo está vencido y no se puede renovar')
      }
      const renewed: StoredLoan = {
        ...loan,
        dueAt: new Date(new Date(loan.dueAt).getTime() + RENEWAL_DAYS * DAY_MS).toISOString(),
        renewalCount: loan.renewalCount + 1,
      }
      store.write({ ...state, loans: state.loans.map((l) => (l.id === loanId ? renewed : l)) })
      return HttpResponse.json(toLoan(renewed))
    }),
  ]
}
