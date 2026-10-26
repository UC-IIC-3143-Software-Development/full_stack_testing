import type { DataSource } from 'typeorm'
import { TypeOrmUnitOfWork } from '../../shared/infrastructure/database/typeorm-unit-of-work'
import { openMigratedDataSource, truncateAll } from '../../../test/support/database'
import { rejectionOf } from '../../../test/support/errors'
import { bookRepositoryContract } from '../../../test/repository-contract/book-repository.contract'
import { aBook, CATALOG } from '../../../test/support/test-data'
import { TypeOrmBookRepository } from './typeorm-book.repository'

describe('Libros en PostgreSQL (Testcontainers)', () => {
  let dataSource: DataSource
  let books: TypeOrmBookRepository

  beforeAll(async () => {
    dataSource = await openMigratedDataSource()
  })

  beforeEach(async () => {
    await truncateAll(dataSource)
    books = new TypeOrmBookRepository(new TypeOrmUnitOfWork(dataSource))
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  // La misma suite que corre contra el fake en memoria en test:unit.
  bookRepositoryContract('PostgreSQL', async () => {
    await truncateAll(dataSource)
    return new TypeOrmBookRepository(new TypeOrmUnitOfWork(dataSource))
  })

  /** Inserta por SQL directo, saltándose el dominio, para probar la red de seguridad de la BD. */
  function insertBookRow(isbn: string, totalCopies: number, availableCopies: number) {
    return dataSource.query(
      `INSERT INTO books (id, isbn, title, author, total_copies, available_copies, search_key, title_key, created_at)
       VALUES (gen_random_uuid(), $1, 'Libro', 'Autor', $2, $3, 'libro autor', 'libro', now())`,
      [isbn, totalCopies, availableCopies],
    )
  }

  it('[BOOK-R2] el índice único rechaza un ISBN repetido aunque se inserte por SQL', async () => {
    await insertBookRow('9788445067314', 1, 1)

    const error = await rejectionOf(insertBookRow('9788445067314', 2, 2))

    expect(error).toMatchObject({ driverError: { code: '23505', constraint: 'uq_books_isbn' } })
  })

  it('[BOOK-R4] el CHECK impide copias disponibles negativas o mayores al total', async () => {
    for (const available of [-1, 3]) {
      const error = await rejectionOf(insertBookRow('9788445067314', 2, available))

      expect(error).toMatchObject({
        driverError: { code: '23514', constraint: 'ck_books_available_copies' },
      })
    }
  })

  it('[BOOK-R4] el CHECK impide un total de copias fuera de 1 a 50', async () => {
    for (const total of [0, 51]) {
      const error = await rejectionOf(insertBookRow('9788445067314', total, 0))

      expect(error).toMatchObject({
        driverError: { code: '23514', constraint: 'ck_books_total_copies' },
      })
    }
  })

  it('[BOOK-R5] los caracteres % y _ se buscan como texto y no como comodines', async () => {
    await books.add(aBook({ ...CATALOG.ficciones, title: 'Ficciones al 100%' }))
    await books.add(aBook(CATALOG.desolacion))

    const percent = await books.search('100%')
    const underscore = await books.search('_')

    expect(percent.map((book) => book.title)).toEqual(['Ficciones al 100%'])
    expect(underscore).toEqual([])
  })
})
