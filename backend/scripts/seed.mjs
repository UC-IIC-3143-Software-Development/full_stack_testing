// Carga los datos de prueba de specs/flows/README.md en un backend que ya está corriendo.
// Usa la API pública (no SQL directo), así la semilla también respeta todas las reglas.
//
//   API_URL=http://localhost:3001 npm run seed
//
// Para dejar "Disponibles" igual que en la tabla, registra préstamos a nombre de
// biblioteca@uc.cl (BOOK-R4 no permite crear un libro con menos copias disponibles que totales).
// Es idempotente: si el ISBN ya existe, ese libro se omite.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '')
const SEED_FILE =
  process.env.SEED_FILE ??
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'specs', 'flows', 'README.md')
const SEED_BORROWER = 'biblioteca@uc.cl'

/** Lee la tabla de la sección "Datos de prueba" del README de flujos. */
function readSeedBooks(markdown) {
  const section = markdown.split('## Datos de prueba')[1] ?? ''
  return section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => /^\d{13}$/.test(cells[2] ?? ''))
    .map(([title, author, isbn, total, available]) => ({
      title,
      author,
      isbn,
      totalCopies: Number(total),
      availableCopies: Number(available),
    }))
}

async function post(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

async function main() {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- ruta fija o elegida por quien corre el script
  const books = readSeedBooks(readFileSync(SEED_FILE, 'utf8'))
  if (books.length === 0) {
    throw new Error(`No encontré libros en ${SEED_FILE}`)
  }
  for (const { availableCopies, ...book } of books) {
    const created = await post('/api/books', book)
    if (created.status === 409) {
      console.log(`Ya existe: ${book.title}`)
      continue
    }
    if (created.status !== 201) {
      throw new Error(`No se pudo crear ${book.title}: ${JSON.stringify(created.body)}`)
    }
    const loansNeeded = book.totalCopies - availableCopies
    // Una persona no puede tener dos préstamos del mismo libro (LOAN-R4): basta con uno por libro.
    if (loansNeeded > 1) {
      throw new Error(`La semilla solo sabe prestar una copia por libro: ${book.title}`)
    }
    if (loansNeeded === 1) {
      const loan = await post('/api/loans', {
        bookId: created.body.id,
        borrowerEmail: SEED_BORROWER,
      })
      if (loan.status !== 201) {
        throw new Error(`No se pudo prestar ${book.title}: ${JSON.stringify(loan.body)}`)
      }
    }
    console.log(`Creado: ${book.title} (${availableCopies} de ${book.totalCopies} disponibles)`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
