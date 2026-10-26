import { createApplication } from '../../../test/support/application-harness'
import { rejectionOf } from '../../../test/support/errors'
import { IsbnAlreadyExistsError } from '../domain/book.errors'

describe('CreateBook', () => {
  it('[BOOK-R2] rechaza un ISBN ya registrado aunque venga con otro formato', async () => {
    const app = createApplication()
    await app.createBook.execute({
      isbn: '9788437604947',
      title: 'Rayuela',
      author: 'Julio Cortázar',
      totalCopies: 1,
    })

    const error = await rejectionOf(
      app.createBook.execute({
        isbn: '978-84-376-0494-7',
        title: 'Rayuela (bolsillo)',
        author: 'Julio Cortázar',
        totalCopies: 1,
      }),
    )

    expect(error).toBeInstanceOf(IsbnAlreadyExistsError)
    expect(error).toMatchObject({ message: 'Ya existe un libro con el ISBN 9788437604947' })
    expect(await app.books.search()).toHaveLength(1)
  })

  it('[BOOK-R4] guarda el libro con todas sus copias disponibles y la fecha del reloj', async () => {
    const app = createApplication()

    const created = await app.createBook.execute({
      isbn: '978-84-376-0494-7',
      title: 'Rayuela',
      author: 'Julio Cortázar',
      totalCopies: 2,
    })

    expect(await app.books.findById(created.id)).toMatchObject({
      totalCopies: 2,
      availableCopies: 2,
      createdAt: new Date('2026-03-02T12:00:00.000Z'),
    })
  })
})
