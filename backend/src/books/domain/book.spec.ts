import { thrownBy } from '../../../test/support/errors'
import { Book, type NewBookInput } from './book'
import { NoCopiesAvailableError } from './book.errors'

const NOW = new Date('2026-03-02T12:00:00.000Z')

function newBook(overrides: Partial<NewBookInput> = {}): Book {
  return Book.create({
    id: '3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f',
    isbn: '978-84-376-0494-7',
    title: 'Rayuela',
    author: 'Julio Cortázar',
    totalCopies: 2,
    now: NOW,
    ...overrides,
  })
}

describe('Book', () => {
  describe('BOOK-R3 título y autor', () => {
    it('[BOOK-R3] guarda título y autor sin espacios al inicio ni al final', () => {
      const book = newBook({ title: '  Rayuela  ', author: '\tJulio Cortázar ' })

      expect([book.title, book.author]).toEqual(['Rayuela', 'Julio Cortázar'])
    })

    it('[BOOK-R3] rechaza un título vacío después de recortar', () => {
      expect(thrownBy(() => newBook({ title: '   ' }))).toMatchObject({
        field: 'title',
        message: 'El título no puede estar vacío',
      })
    })

    it('[BOOK-R3] rechaza un autor vacío después de recortar', () => {
      expect(thrownBy(() => newBook({ author: ' ' }))).toMatchObject({
        field: 'author',
        message: 'El autor no puede estar vacío',
      })
    })

    it('[BOOK-R3] acepta un título de 200 caracteres y rechaza uno de 201', () => {
      expect(newBook({ title: 'á'.repeat(200) }).title).toHaveLength(200)
      expect(thrownBy(() => newBook({ title: 'á'.repeat(201) }))).toMatchObject({
        field: 'title',
        message: 'El título puede tener como máximo 200 caracteres',
      })
    })

    it('[BOOK-R3] acepta un autor de 120 caracteres y rechaza uno de 121', () => {
      expect(newBook({ author: 'b'.repeat(120) }).author).toHaveLength(120)
      expect(thrownBy(() => newBook({ author: 'b'.repeat(121) }))).toMatchObject({
        field: 'author',
        message: 'El autor puede tener como máximo 120 caracteres',
      })
    })
  })

  describe('BOOK-R4 copias', () => {
    it('[BOOK-R4] al crear, las copias disponibles son iguales a las totales', () => {
      const book = newBook({ totalCopies: 3 })

      expect([book.totalCopies, book.availableCopies]).toEqual([3, 3])
    })

    it('[BOOK-R4] acepta los límites 1 y 50', () => {
      expect(newBook({ totalCopies: 1 }).totalCopies).toBe(1)
      expect(newBook({ totalCopies: 50 }).totalCopies).toBe(50)
    })

    it('[BOOK-R4] rechaza 0, 51 y cantidades no enteras', () => {
      for (const totalCopies of [0, 51, 2.5]) {
        expect(thrownBy(() => newBook({ totalCopies }))).toMatchObject({
          field: 'totalCopies',
          message: 'La cantidad de copias debe ser un entero entre 1 y 50',
        })
      }
    })
  })

  describe('BOOK-R5 claves de búsqueda', () => {
    it('[BOOK-R5] genera claves sin tildes ni mayúsculas para buscar y ordenar', () => {
      const book = newBook({ title: 'Cien Años de Soledad', author: 'Gabriel García Márquez' })

      expect(book.searchKey).toBe('cien anos de soledad gabriel garcia marquez')
      expect(book.titleKey).toBe('cien anos de soledad')
    })
  })

  describe('LOAN-R1 copias disponibles al prestar', () => {
    it('[LOAN-R1] prestar descuenta una copia sin modificar el libro original', () => {
      const book = newBook({ totalCopies: 2 })

      const lent = book.lendCopy()

      expect([lent.availableCopies, book.availableCopies]).toEqual([1, 2])
    })

    it('[LOAN-R1] un libro sin copias disponibles no se puede prestar', () => {
      const exhausted = newBook({ totalCopies: 1 }).lendCopy()

      expect(thrownBy(() => exhausted.lendCopy())).toBeInstanceOf(NoCopiesAvailableError)
    })
  })
})
