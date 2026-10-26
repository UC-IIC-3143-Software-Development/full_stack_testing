import { createApplication } from '../../../test/support/application-harness'
import { rejectionOf } from '../../../test/support/errors'
import { aBook, CATALOG, nextUuid } from '../../../test/support/test-data'
import { BookNotFoundError } from '../domain/book.errors'
import { GetBook } from './get-book'

describe('GetBook', () => {
  it('[BOOK-R6] devuelve el libro si existe y BOOK_NOT_FOUND si no existe', async () => {
    const { books } = createApplication()
    const desolacion = aBook(CATALOG.desolacion)
    await books.add(desolacion)
    const getBook = new GetBook(books)

    expect((await getBook.execute(desolacion.id)).title).toBe('Desolación')
    expect(await rejectionOf(getBook.execute(nextUuid()))).toBeInstanceOf(BookNotFoundError)
  })
})
