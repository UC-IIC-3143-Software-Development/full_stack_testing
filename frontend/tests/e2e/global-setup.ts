// Siembra del stack real para test:e2e:smoke (E2E_TARGET=fullstack). Usa la API pública
// (a través del rewrite /api de Next), igual que lo haría una persona. Es idempotente:
// se puede correr muchas veces contra la misma base de datos.
import type { FullConfig } from '@playwright/test'
import { BOOK_IDS, createSeedState } from '../../src/mocks/fixtures'

interface BookDto {
  id: string
  isbn: string
  title: string
  totalCopies: number
  availableCopies: number
}
interface LoanDto {
  id: string
  returnedAt: string | null
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = String(config.projects[0]?.use.baseURL ?? process.env.E2E_BASE_URL)
  const api = (path: string, init?: RequestInit) =>
    fetch(new URL(path, baseURL), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })

  await waitForHealthyApi(api)

  // 1. Libros de specs/flows/README.md (si ya existen, el 409 se ignora).
  const seed = createSeedState()
  for (const { isbn, title, author, totalCopies } of seed.books) {
    const response = await api('/api/books', {
      method: 'POST',
      body: JSON.stringify({ isbn, title, author, totalCopies }),
    })
    if (![201, 409].includes(response.status)) {
      throw new Error(`No se pudo sembrar "${title}": ${response.status}`)
    }
  }

  const byIsbn = async (isbn: string) => {
    const books = (await (await api('/api/books')).json()) as BookDto[]
    const book = books.find((b) => b.isbn === isbn)
    if (!book) throw new Error(`Falta el libro ${isbn}`)
    return book
  }

  // 2. Los escenarios @smoke usan a ana@uc.cl: devolvemos lo que haya quedado de otra corrida.
  const anaLoans = (await (await api('/api/loans?borrowerEmail=ana@uc.cl')).json()) as LoanDto[]
  for (const loan of anaLoans.filter((l) => l.returnedAt === null)) {
    await api(`/api/loans/${loan.id}/return`, { method: 'POST' })
  }

  // 3. Mismas copias disponibles que el mock: Ficciones 1 de 2 y La casa de los espíritus 0 de 1.
  const seededIsbn = (id: string) => seed.books.find((b) => b.id === id)!.isbn
  for (const id of [BOOK_IDS.ficciones, BOOK_IDS.casaEspiritus]) {
    const book = await byIsbn(seededIsbn(id))
    if (book.availableCopies === book.totalCopies) {
      await api('/api/loans', {
        method: 'POST',
        body: JSON.stringify({ bookId: book.id, borrowerEmail: 'carla@uc.cl' }),
      })
    }
  }
}

async function waitForHealthyApi(api: (path: string) => Promise<Response>) {
  // Espera activa con plazo: el stack puede tardar en levantar la base de datos.
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const healthy = await api('/api/health')
      .then((r) => r.ok)
      .catch(() => false)
    if (healthy) return
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('La API no respondió /api/health a tiempo')
}
