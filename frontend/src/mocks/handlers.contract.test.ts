// Contrato bidireccional, lado CONSUMIDOR (P2.3): las respuestas del mock server deben
// cumplir specs/api/openapi.yaml. Si el mock miente, los tests del frontend pasan contra
// una API que no existe. El backend valida el lado PROVEEDOR con sus propios tests.
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { HttpHandler } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { createMemoryStore } from './db'
import { BOOK_IDS, FIXED_NOW } from './fixtures'
import { createHandlers } from './handlers'

type Method = 'GET' | 'POST'
interface ApiRequest {
  method: Method
  path: string
  body?: unknown
}
interface ContractCase {
  request: ApiRequest
  status: number
  /** Código de error esperado (para los problem+json). */
  code?: string
  /** Solicitudes previas para preparar el estado. */
  given?: ApiRequest[]
}

// ---------- 1. El contrato ----------
interface OpenApiResponse {
  $ref?: string
  content?: Record<string, { schema: object }>
}
interface OpenApiOperation {
  operationId: string
  responses: Record<string, OpenApiResponse>
}
interface OpenApiDoc {
  paths: Record<string, Partial<Record<'get' | 'post', OpenApiOperation>>>
  components: {
    schemas: Record<string, object>
    responses: Record<string, OpenApiResponse>
  }
}

const spec = parse(
  readFileSync(new URL('../../../specs/api/openapi.yaml', import.meta.url), 'utf8'),
) as OpenApiDoc

// OpenAPI 3.1 usa JSON Schema 2020-12. Movemos components/schemas a $defs para que Ajv
// resuelva los $ref y agregamos "example" como palabra clave conocida (solo documenta).
const ROOT_ID = 'openapi.json'
function rewriteRefs<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value).replaceAll('"#/components/schemas/', `"${ROOT_ID}#/$defs/`),
  ) as T
}
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
ajv.addKeyword('example')
ajv.addSchema({ $id: ROOT_ID, $defs: rewriteRefs(spec.components.schemas) })

interface SpecOperation {
  method: Method
  path: string
  pattern: RegExp
  operation: OpenApiOperation
}
const operations: SpecOperation[] = Object.entries(spec.paths).flatMap(([path, item]) =>
  (['get', 'post'] as const)
    .filter((m) => item[m])
    .map((m) => ({
      method: m.toUpperCase() as Method,
      path,
      pattern: new RegExp(`^${path.replace(/\{\w+\}/g, '[^/]+')}$`),
      operation: item[m]!,
    })),
)

function operationFor(request: ApiRequest): SpecOperation {
  const pathname = new URL(request.path, 'http://localhost').pathname
  const found = operations.find((op) => op.method === request.method && op.pattern.test(pathname))
  if (!found) throw new Error(`${request.method} ${pathname} no existe en el contrato`)
  return found
}

function documentedResponse(op: SpecOperation, status: number): OpenApiResponse | undefined {
  const response = op.operation.responses[String(status)]
  if (!response?.$ref) return response
  return spec.components.responses[response.$ref.split('/').pop()!]
}

// ---------- 2. El mock server, igual al de los tests de componentes ----------
const store = createMemoryStore()
const server = setupServer(...createHandlers(store, { now: () => new Date(FIXED_NOW) }))
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
beforeEach(() => store.reset())
afterAll(() => server.close())

function send({ method, path, body }: ApiRequest) {
  return fetch(new URL(path, 'http://localhost'), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function expectContract(testCase: ContractCase) {
  for (const previous of testCase.given ?? []) await send(previous)
  const op = operationFor(testCase.request)
  const response = await send(testCase.request)

  expect(response.status).toBe(testCase.status)
  const documented = documentedResponse(op, response.status)
  expect(
    documented,
    `${op.operation.operationId} no documenta el status ${response.status}`,
  ).not.toBeUndefined()

  // "application/problem+json" sin parámetros como el charset.
  const mediaType = (response.headers.get('content-type') ?? '').replace(/\s*\u003b.*$/, '')
  const content = documented!.content?.[mediaType]
  expect(
    content,
    `${op.operation.operationId} ${response.status} no documenta ${mediaType}`,
  ).not.toBeUndefined()

  const body: unknown = await response.json()
  const validate = ajv.compile(rewriteRefs(content!.schema))
  expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
  if (testCase.code) expect(body).toMatchObject({ code: testCase.code })
}

// ---------- 3. Casos: un éxito y cada error documentado de cada operación ----------
const newLoan = (bookId: string, borrowerEmail: string): ApiRequest => ({
  method: 'POST',
  path: '/api/loans',
  body: { bookId, borrowerEmail },
})
const newBook = (isbn: string, title: string): ApiRequest => ({
  method: 'POST',
  path: '/api/books',
  body: { isbn, title, author: 'Autora de prueba', totalCopies: 2 },
})
const renew = (loanId: string): ApiRequest => ({
  method: 'POST',
  path: `/api/loans/${loanId}/renew`,
})
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const OVERDUE_LOAN = '0a7d3b52-1c4e-4f8a-9b6d-000000000101'
const ACTIVE_LOAN = '0a7d3b52-1c4e-4f8a-9b6d-000000000102'
const RETURNED_LOAN = '0a7d3b52-1c4e-4f8a-9b6d-000000000103'

// Los datos de cada caso viven en esta tabla. Los títulos (con el ID de la regla) están
// escritos literalmente en cada it() para que tools/spec-trace.mjs los pueda leer.
const CASES = {
  health: { request: { method: 'GET', path: '/api/health' }, status: 200 },
  listBooks: { request: { method: 'GET', path: '/api/books?q=garcia' }, status: 200 },
  listBooksLongQuery: {
    request: { method: 'GET', path: `/api/books?q=${'x'.repeat(101)}` },
    status: 400,
    code: 'VALIDATION_ERROR',
  },
  createBook: { request: newBook('978-84-376-0494-7', 'Rayuela'), status: 201 },
  createBookInvalidIsbn: {
    request: newBook('978-0-00-000000-1', 'Libro falso'),
    status: 400,
    code: 'VALIDATION_ERROR',
  },
  createBookDuplicate: {
    request: newBook('9780307474728', 'Otra edición'),
    status: 409,
    code: 'ISBN_ALREADY_EXISTS',
  },
  getBook: { request: { method: 'GET', path: `/api/books/${BOOK_IDS.ficciones}` }, status: 200 },
  getBookUnknown: {
    request: { method: 'GET', path: `/api/books/${UNKNOWN_ID}` },
    status: 404,
    code: 'BOOK_NOT_FOUND',
  },
  getBookBadId: {
    request: { method: 'GET', path: '/api/books/no-es-uuid' },
    status: 400,
    code: 'VALIDATION_ERROR',
  },
  listLoans: {
    request: { method: 'GET', path: '/api/loans?borrowerEmail=carla@uc.cl' },
    status: 200,
  },
  listLoansBadEmail: {
    request: { method: 'GET', path: '/api/loans?borrowerEmail=no-es-correo' },
    status: 400,
    code: 'VALIDATION_ERROR',
  },
  createLoan: { request: newLoan(BOOK_IDS.cienAnos, 'Ana@UC.cl'), status: 201 },
  createLoanBadEmail: {
    request: newLoan(BOOK_IDS.cienAnos, 'ana-sin-arroba'),
    status: 400,
    code: 'VALIDATION_ERROR',
  },
  createLoanUnknownBook: {
    request: newLoan(UNKNOWN_ID, 'ana@uc.cl'),
    status: 404,
    code: 'BOOK_NOT_FOUND',
  },
  createLoanNoCopies: {
    request: newLoan(BOOK_IDS.casaEspiritus, 'ana@uc.cl'),
    status: 409,
    code: 'NO_COPIES_AVAILABLE',
  },
  createLoanLimit: {
    given: [
      newLoan(BOOK_IDS.cienAnos, 'beto@uc.cl'),
      newLoan(BOOK_IDS.ficciones, 'beto@uc.cl'),
      newLoan(BOOK_IDS.desolacion, 'beto@uc.cl'),
    ],
    request: newLoan(BOOK_IDS.veintePoemas, 'beto@uc.cl'),
    status: 409,
    code: 'LOAN_LIMIT_REACHED',
  },
  createLoanDuplicate: {
    request: newLoan(BOOK_IDS.ficciones, 'carla@uc.cl'),
    status: 409,
    code: 'DUPLICATE_LOAN',
  },
  returnLoan: {
    request: { method: 'POST', path: `/api/loans/${ACTIVE_LOAN}/return` },
    status: 200,
  },
  returnLoanUnknown: {
    request: { method: 'POST', path: `/api/loans/${UNKNOWN_ID}/return` },
    status: 404,
    code: 'LOAN_NOT_FOUND',
  },
  returnLoanTwice: {
    request: { method: 'POST', path: `/api/loans/${RETURNED_LOAN}/return` },
    status: 409,
    code: 'ALREADY_RETURNED',
  },
  returnLoanBadId: {
    request: { method: 'POST', path: '/api/loans/123/return' },
    status: 400,
    code: 'VALIDATION_ERROR',
  },
  renewLoan: { request: renew(ACTIVE_LOAN), status: 200 },
  renewLoanTwice: {
    given: [renew(ACTIVE_LOAN)],
    request: renew(ACTIVE_LOAN),
    status: 409,
    code: 'RENEWAL_LIMIT_REACHED',
  },
  renewLoanOverdue: { request: renew(OVERDUE_LOAN), status: 409, code: 'LOAN_OVERDUE' },
  renewLoanReturned: { request: renew(RETURNED_LOAN), status: 409, code: 'ALREADY_RETURNED' },
  renewLoanUnknown: { request: renew(UNKNOWN_ID), status: 404, code: 'LOAN_NOT_FOUND' },
  renewLoanBadId: { request: renew('123'), status: 400, code: 'VALIDATION_ERROR' },
} satisfies Record<string, ContractCase>

describe('Mock server vs specs/api/openapi.yaml', () => {
  it('[MOCK-R2] getHealth responde 200 según el contrato', () => expectContract(CASES.health))
  it('[BOOK-R5] listBooks responde 200 con un arreglo de Book', () =>
    expectContract(CASES.listBooks))
  it('[BOOK-R5] listBooks responde 400 si q supera 100 caracteres', () =>
    expectContract(CASES.listBooksLongQuery))
  it('[BOOK-R1] createBook responde 201 con un ISBN válido', () => expectContract(CASES.createBook))
  it('[BOOK-R1] createBook responde 400 con un ISBN inválido', () =>
    expectContract(CASES.createBookInvalidIsbn))
  it('[BOOK-R2] createBook responde 409 con un ISBN repetido', () =>
    expectContract(CASES.createBookDuplicate))
  it('[BOOK-R6] getBook responde 200 con un libro existente', () => expectContract(CASES.getBook))
  it('[BOOK-R6] getBook responde 404 si el libro no existe', () =>
    expectContract(CASES.getBookUnknown))
  it('[BOOK-R6] getBook responde 400 si bookId no es un UUID', () =>
    expectContract(CASES.getBookBadId))
  it('[LOAN-R6] listLoans responde 200 con préstamos y su estado', () =>
    expectContract(CASES.listLoans))
  it('[LOAN-R7] listLoans responde 400 con un correo inválido', () =>
    expectContract(CASES.listLoansBadEmail))
  it('[LOAN-R1] createLoan responde 201 cuando hay copias', () => expectContract(CASES.createLoan))
  it('[LOAN-R7] createLoan responde 400 con un correo inválido', () =>
    expectContract(CASES.createLoanBadEmail))
  it('[LOAN-R7] createLoan responde 404 si el libro no existe', () =>
    expectContract(CASES.createLoanUnknownBook))
  it('[LOAN-R1] createLoan responde 409 sin copias disponibles', () =>
    expectContract(CASES.createLoanNoCopies))
  it('[LOAN-R2] createLoan responde 409 con el cuarto préstamo no devuelto', () =>
    expectContract(CASES.createLoanLimit))
  it('[LOAN-R4] createLoan responde 409 si ya tiene ese libro prestado', () =>
    expectContract(CASES.createLoanDuplicate))
  it('[LOAN-R5] returnLoan responde 200 al devolver un préstamo activo', () =>
    expectContract(CASES.returnLoan))
  it('[LOAN-R5] returnLoan responde 404 si el préstamo no existe', () =>
    expectContract(CASES.returnLoanUnknown))
  it('[LOAN-R5] returnLoan responde 409 si ya fue devuelto', () =>
    expectContract(CASES.returnLoanTwice))
  it('[LOAN-R5] returnLoan responde 400 si loanId no es un UUID', () =>
    expectContract(CASES.returnLoanBadId))
  it('[RENEW-R1] renewLoan responde 200 al renovar un préstamo al día', () =>
    expectContract(CASES.renewLoan))
  it('[RENEW-R2] renewLoan responde 409 si el préstamo ya se renovó', () =>
    expectContract(CASES.renewLoanTwice))
  it('[RENEW-R3] renewLoan responde 409 si el préstamo está vencido', () =>
    expectContract(CASES.renewLoanOverdue))
  it('[RENEW-R3] renewLoan responde 409 si el préstamo ya fue devuelto', () =>
    expectContract(CASES.renewLoanReturned))
  it('[RENEW-R4] renewLoan responde 404 si el préstamo no existe', () =>
    expectContract(CASES.renewLoanUnknown))
  it('[RENEW-R4] renewLoan responde 400 si loanId no es un UUID', () =>
    expectContract(CASES.renewLoanBadId))
})

describe('Cobertura del contrato en el mock server', () => {
  it('[MOCK-R1] hay un handler MSW para cada operación del contrato', () => {
    const handlers = server
      .listHandlers()
      .filter((h) => h instanceof HttpHandler)
      .map((h) => `${String(h.info.method)} ${String(h.info.path)}`)
    const expected = operations.map((op) => `${op.method} *${op.path.replace(/\{(\w+)\}/g, ':$1')}`)
    expect(handlers.sort()).toEqual(expected.sort())
  })

  it('[MOCK-R1] la tabla de casos ejercita cada status documentado', () => {
    // Se calcula desde la tabla, no desde lo que ya corrió: no depende del orden (P4.5).
    const documented = operations.flatMap((op) =>
      Object.keys(op.operation.responses).map((status) => `${op.operation.operationId} ${status}`),
    )
    const exercised = new Set(
      Object.values(CASES).map(
        (c: ContractCase) => `${operationFor(c.request).operation.operationId} ${c.status}`,
      ),
    )
    expect(documented.filter((key) => !exercised.has(key))).toEqual([])
  })
})
