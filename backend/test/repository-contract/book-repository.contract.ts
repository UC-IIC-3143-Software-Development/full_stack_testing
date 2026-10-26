import type { BookRepository } from '../../src/books/application/book.repository'
import { IsbnAlreadyExistsError } from '../../src/books/domain/book.errors'
import { aBook, CATALOG, nextUuid } from '../support/test-data'

/**
 * Suite de contrato del puerto BookRepository ("fakes que no mienten").
 * Se ejecuta contra InMemoryBookRepository en test:unit y contra TypeOrmBookRepository
 * (PostgreSQL real con Testcontainers) en test:integration. Si el fake se aleja del
 * comportamiento real, esta suite falla en una de las dos corridas.
 *
 * `createRepository` debe entregar un repositorio vacío en cada test.
 */
export function bookRepositoryContract(
  implementation: string,
  createRepository: () => Promise<BookRepository>,
): void {
  describe(`Contrato de BookRepository: ${implementation}`, () => {
    let books: BookRepository

    beforeEach(async () => {
      books = await createRepository()
    })

    it('[BOOK-R2] rechaza un segundo libro con el mismo ISBN normalizado', async () => {
      await books.add(aBook(CATALOG.ficciones))
      const sameIsbn = aBook({ ...CATALOG.ficciones, title: 'Ficciones (otra edición)' })

      await expect(books.add(sameIsbn)).rejects.toThrow(IsbnAlreadyExistsError)
      expect(await books.search()).toHaveLength(1)
    })

    it('[BOOK-R5] busca por autor sin distinguir tildes ni mayúsculas', async () => {
      await books.add(aBook(CATALOG.cienAnos))
      await books.add(aBook(CATALOG.desolacion))

      const found = await books.search('GARCIA marquez')

      expect(found.map((book) => book.title)).toEqual(['Cien años de soledad'])
    })

    it('[BOOK-R5] sin texto de búsqueda (o en blanco) lista todos ordenados por título', async () => {
      await books.add(aBook(CATALOG.pedroParamo))
      await books.add(aBook(CATALOG.cienAnos))
      await books.add(aBook(CATALOG.desolacion))
      const sorted = ['Cien años de soledad', 'Desolación', 'Pedro Páramo']

      expect((await books.search()).map((book) => book.title)).toEqual(sorted)
      expect((await books.search('   ')).map((book) => book.title)).toEqual(sorted)
    })

    it('[BOOK-R6] encuentra un libro por id y devuelve null si no existe', async () => {
      const book = aBook(CATALOG.desolacion, 2)
      await books.add(book)

      expect(await books.findById(book.id)).toMatchObject({
        title: 'Desolación',
        author: 'Gabriela Mistral',
        totalCopies: 2,
        availableCopies: 2,
      })
      expect(await books.findById(nextUuid())).toBeNull()
    })

    it('[LOAN-R1] descuenta copias solo mientras queden disponibles', async () => {
      const book = aBook(CATALOG.ficciones, 1)
      await books.add(book)

      expect(await books.takeCopy(book.id)).toBe(true)
      expect(await books.takeCopy(book.id)).toBe(false)
      expect((await books.findById(book.id))?.availableCopies).toBe(0)
    })

    it('[LOAN-R5] repone copias sin superar el total', async () => {
      const book = aBook(CATALOG.ficciones, 2)
      await books.add(book)
      await books.takeCopy(book.id)

      expect(await books.releaseCopy(book.id)).toBe(true)
      expect(await books.releaseCopy(book.id)).toBe(false)
      expect((await books.findById(book.id))?.availableCopies).toBe(2)
    })
  })
}
