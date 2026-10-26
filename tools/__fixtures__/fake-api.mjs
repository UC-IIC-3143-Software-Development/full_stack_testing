// Fake en memoria de la API de la Biblioteca UC (specs/api/openapi.yaml).
//
// Es un doble de prueba para las herramientas de tools/ (api-smoke, seed-stack, k6):
// permite probarlas sin levantar NestJS ni PostgreSQL. No reemplaza al backend real
// ni a sus tests: implementa solo lo necesario para que el contrato se cumpla.
//
// Uso manual: node tools/__fixtures__/fake-api.mjs --port 4010
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY_MS = 24 * 60 * 60 * 1000

const normalizeText = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function isValidIsbn(raw) {
  const digits = String(raw).replace(/[-\s]/g, '')
  if (!/^97[89]\d{10}$/.test(digits)) return null
  const sum = [...digits.slice(0, 12)].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  )
  return (10 - (sum % 10)) % 10 === Number(digits[12]) ? digits : null
}

export function createFakeApi({ now = () => new Date() } = {}) {
  const books = new Map()
  const loans = new Map()

  const problem = (res, status, code, detail, errors) => {
    const titles = { 400: 'Bad Request', 404: 'Not Found', 409: 'Conflict' }
    const body = { type: 'about:blank', title: titles[status], status, code, detail }
    if (errors) body.errors = errors
    res.writeHead(status, { 'content-type': 'application/problem+json' })
    res.end(JSON.stringify(body))
  }
  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const invalid = (res, field, message) =>
    problem(res, 400, 'VALIDATION_ERROR', 'La solicitud tiene campos inválidos', [
      { field, message },
    ])

  const loanView = (loan) => {
    let status = 'ACTIVE'
    if (loan.returnedAt) status = 'RETURNED'
    else if (now().getTime() > new Date(loan.dueAt).getTime()) status = 'OVERDUE'
    return { ...loan, status }
  }

  const routes = [
    ['GET', /^\/api\/health$/, (req, res) => json(res, 200, { status: 'ok' })],
    [
      'GET',
      /^\/api\/books$/,
      (req, res, params, url) => {
        const q = url.searchParams.get('q')
        if (q !== null && q.length > 100) return invalid(res, 'q', 'Máximo 100 caracteres')
        const list = [...books.values()]
          .filter((b) => !q || normalizeText(`${b.title} ${b.author}`).includes(normalizeText(q)))
          .sort((a, b) => a.title.localeCompare(b.title, 'es'))
        return json(res, 200, list)
      },
    ],
    [
      'POST',
      /^\/api\/books$/,
      (req, res, params, url, body) => {
        if (!body || typeof body !== 'object') return invalid(res, 'body', 'Cuerpo inválido')
        const isbn = typeof body.isbn === 'string' ? isValidIsbn(body.isbn) : null
        if (!isbn) return invalid(res, 'isbn', 'El ISBN no es válido')
        const title = typeof body.title === 'string' ? body.title.trim() : ''
        const author = typeof body.author === 'string' ? body.author.trim() : ''
        if (title.length < 1 || title.length > 200) return invalid(res, 'title', 'Título inválido')
        if (author.length < 1 || author.length > 120)
          return invalid(res, 'author', 'Autor inválido')
        const copies = body.totalCopies
        if (!Number.isInteger(copies) || copies < 1 || copies > 50) {
          return invalid(res, 'totalCopies', 'Copias inválidas')
        }
        if ([...books.values()].some((b) => b.isbn === isbn)) {
          return problem(res, 409, 'ISBN_ALREADY_EXISTS', `Ya existe un libro con el ISBN ${isbn}`)
        }
        const book = {
          id: randomUUID(),
          isbn,
          title,
          author,
          totalCopies: copies,
          availableCopies: copies,
          createdAt: now().toISOString(),
        }
        books.set(book.id, book)
        return json(res, 201, book)
      },
    ],
    [
      'GET',
      /^\/api\/books\/([^/]+)$/,
      (req, res, [id]) => {
        if (!UUID.test(id)) return invalid(res, 'bookId', 'Debe ser un UUID')
        const book = books.get(id)
        if (!book) return problem(res, 404, 'BOOK_NOT_FOUND', 'No existe el libro solicitado')
        return json(res, 200, book)
      },
    ],
    [
      'GET',
      /^\/api\/loans$/,
      (req, res, params, url) => {
        const email = (url.searchParams.get('borrowerEmail') ?? '').trim().toLowerCase()
        if (!EMAIL.test(email)) return invalid(res, 'borrowerEmail', 'Correo inválido')
        const list = [...loans.values()]
          .filter((loan) => loan.borrowerEmail === email)
          .sort((a, b) => b.loanedAt.localeCompare(a.loanedAt))
          .map(loanView)
        return json(res, 200, list)
      },
    ],
    [
      'POST',
      /^\/api\/loans$/,
      (req, res, params, url, body) => {
        const bookId = body?.bookId
        const email =
          typeof body?.borrowerEmail === 'string' ? body.borrowerEmail.trim().toLowerCase() : ''
        if (typeof bookId !== 'string' || !UUID.test(bookId)) {
          return invalid(res, 'bookId', 'Debe ser un UUID')
        }
        if (!EMAIL.test(email)) return invalid(res, 'borrowerEmail', 'Correo inválido')
        const book = books.get(bookId)
        if (!book) return problem(res, 404, 'BOOK_NOT_FOUND', 'No existe el libro solicitado')
        const open = [...loans.values()].filter((l) => l.borrowerEmail === email && !l.returnedAt)
        if (open.length >= 3) {
          return problem(res, 409, 'LOAN_LIMIT_REACHED', `${email} ya tiene 3 préstamos activos`)
        }
        if (open.some((l) => l.bookId === bookId)) {
          return problem(res, 409, 'DUPLICATE_LOAN', 'Ya tiene este libro prestado')
        }
        if (book.availableCopies === 0) {
          return problem(res, 409, 'NO_COPIES_AVAILABLE', 'No quedan copias disponibles')
        }
        book.availableCopies -= 1
        const loanedAt = now()
        const loan = {
          id: randomUUID(),
          bookId,
          bookTitle: book.title,
          borrowerEmail: email,
          loanedAt: loanedAt.toISOString(),
          dueAt: new Date(loanedAt.getTime() + 14 * DAY_MS).toISOString(),
          returnedAt: null,
        }
        loans.set(loan.id, loan)
        return json(res, 201, loanView(loan))
      },
    ],
    [
      'POST',
      /^\/api\/loans\/([^/]+)\/return$/,
      (req, res, [id]) => {
        if (!UUID.test(id)) return invalid(res, 'loanId', 'Debe ser un UUID')
        const loan = loans.get(id)
        if (!loan) return problem(res, 404, 'LOAN_NOT_FOUND', 'No existe el préstamo')
        if (loan.returnedAt)
          return problem(res, 409, 'ALREADY_RETURNED', 'El préstamo ya fue devuelto')
        loan.returnedAt = now().toISOString()
        books.get(loan.bookId).availableCopies += 1
        return json(res, 200, loanView(loan))
      },
    ],
  ]

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fake')
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    let body = null
    if (chunks.length > 0) {
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        return invalid(res, 'body', 'JSON inválido')
      }
    }
    for (const [method, pattern, handler] of routes) {
      const match = url.pathname.match(pattern)
      if (match && req.method === method) return handler(req, res, match.slice(1), url, body)
    }
    return problem(res, 404, 'BOOK_NOT_FOUND', 'Ruta inexistente')
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const portIndex = process.argv.indexOf('--port')
  const port = portIndex > -1 ? Number(process.argv[portIndex + 1]) : 4010
  const fixed = process.env.CLOCK_FIXED_NOW
  const server = createFakeApi({ now: () => (fixed ? new Date(fixed) : new Date()) })
  server.listen(port, '127.0.0.1', () => {
    console.log(`Fake API en http://127.0.0.1:${server.address().port}`)
  })
}
