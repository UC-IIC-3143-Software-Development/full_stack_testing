#!/usr/bin/env node
// Siembra el stack real con los datos de prueba de specs/flows/README.md.
//
// Se ejecuta en la etapa 9 antes de los E2E @smoke. Usa solo la API pública
// (nunca SQL directo): así la siembra respeta las mismas reglas de negocio que
// una persona usuaria. Es idempotente: si un libro ya existe no lo duplica, y
// solo crea los préstamos que faltan para llegar a las copias disponibles.
//
// Uso: BASE_URL=http://localhost:3001 node tools/seed-stack.mjs
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const SEED_BOOKS = [
  {
    title: 'Cien años de soledad',
    author: 'Gabriel García Márquez',
    isbn: '9780307474728',
    total: 3,
    available: 3,
  },
  {
    title: 'Desolación',
    author: 'Gabriela Mistral',
    isbn: '9789561112087',
    total: 1,
    available: 1,
  },
  {
    title: 'Ficciones',
    author: 'Jorge Luis Borges',
    isbn: '9788445067314',
    total: 2,
    available: 1,
  },
  {
    title: 'La casa de los espíritus',
    author: 'Isabel Allende',
    isbn: '9780063376779',
    total: 1,
    available: 0,
  },
  { title: 'Pedro Páramo', author: 'Juan Rulfo', isbn: '9786073105484', total: 2, available: 2 },
  {
    title: 'Veinte poemas de amor y una canción desesperada',
    author: 'Pablo Neruda',
    isbn: '9789562390910',
    total: 2,
    available: 2,
  },
]

// Los préstamos que bajan las copias disponibles quedan a nombre de esta persona.
const SEED_BORROWER = 'siembra@uc.cl'

async function request(baseUrl, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

export async function seed(baseUrl, log = console.log) {
  const { json: existing } = await request(baseUrl, 'GET', '/api/books')
  const byIsbn = new Map((existing ?? []).map((book) => [book.isbn, book]))

  for (const seedBook of SEED_BOOKS) {
    let book = byIsbn.get(seedBook.isbn)
    if (!book) {
      const created = await request(baseUrl, 'POST', '/api/books', {
        isbn: seedBook.isbn,
        title: seedBook.title,
        author: seedBook.author,
        totalCopies: seedBook.total,
      })
      if (created.status !== 201) {
        throw new Error(`No se pudo crear "${seedBook.title}": HTTP ${created.status}`)
      }
      book = created.json
      log(`creado     ${seedBook.title}`)
    } else {
      log(`ya existe  ${seedBook.title}`)
    }
    let available = book.availableCopies
    while (available > seedBook.available) {
      // Cada préstamo usa un correo distinto para no chocar con LOAN-R2 ni LOAN-R4
      const borrower = SEED_BORROWER.replace('@', `${available}@`)
      const loan = await request(baseUrl, 'POST', '/api/loans', {
        bookId: book.id,
        borrowerEmail: borrower,
      })
      if (loan.status !== 201) {
        throw new Error(`No se pudo prestar "${seedBook.title}": HTTP ${loan.status}`)
      }
      available -= 1
      log(`prestado   ${seedBook.title} (quedan ${available})`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const baseUrl = (process.env.BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  await seed(baseUrl)
  console.log('Siembra lista.')
}
