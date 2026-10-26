import type { DataSource } from 'typeorm'
import { databaseUrl } from '../../test/support/database'
import { rejectionOf } from '../../test/support/errors'
import { createDataSource } from './data-source'

/** Corre `work` en una base de datos aparte, para no interferir con los otros tests de integración. */
async function withScratchDatabase(
  name: string,
  work: (dataSource: DataSource) => Promise<void>,
): Promise<void> {
  const admin = await createDataSource({ databaseUrl: databaseUrl() }).initialize()
  await admin.query(`DROP DATABASE IF EXISTS ${name}`)
  await admin.query(`CREATE DATABASE ${name}`)
  const url = new URL(databaseUrl())
  url.pathname = `/${name}`
  const dataSource = await createDataSource({ databaseUrl: url.toString() }).initialize()
  try {
    await work(dataSource)
  } finally {
    await dataSource.destroy()
    await admin.query(`DROP DATABASE ${name}`)
    await admin.destroy()
  }
}

describe('Migraciones (Testcontainers)', () => {
  it('[BOOK-R2] [BOOK-R4] [LOAN-R4] crean tablas, índices y restricciones, y se pueden revertir', async () => {
    await withScratchDatabase('migrations_check', async (dataSource) => {
      await dataSource.runMigrations()
      const constraints: { conname: string }[] = await dataSource.query(
        `SELECT conname FROM pg_constraint
         WHERE conrelid IN ('books'::regclass, 'loans'::regclass) ORDER BY conname`,
      )
      const indexes: { indexname: string }[] = await dataSource.query(
        `SELECT indexname FROM pg_indexes WHERE tablename IN ('books', 'loans') ORDER BY indexname`,
      )
      expect(constraints.map((row) => row.conname)).toEqual([
        'books_pkey',
        'ck_books_available_copies',
        'ck_books_total_copies',
        'ck_loans_renewal_count',
        'fk_loans_book',
        'loans_pkey',
      ])
      expect(indexes.map((row) => row.indexname)).toEqual([
        'books_pkey',
        'ix_books_title_key',
        'ix_loans_borrower',
        'loans_pkey',
        'uq_books_isbn',
        'uq_loans_unreturned_book_borrower',
      ])

      await dataSource.undoLastMigration()
      await dataSource.undoLastMigration()
      const tables: { tablename: string }[] = await dataSource.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      )
      expect(tables.map((row) => row.tablename)).toEqual(['migrations'])
    })
  })

  it('[RENEW-R2] los préstamos que ya existían parten con renewal_count 0 y el CHECK no deja pasar de 1', async () => {
    await withScratchDatabase('migrations_renewal_check', async (dataSource) => {
      await dataSource.runMigrations()
      await dataSource.undoLastMigration() // vuelve al esquema anterior a SPEC-LIB-03
      await dataSource.query(
        `INSERT INTO books (id, isbn, title, author, total_copies, available_copies,
                            search_key, title_key, created_at)
         VALUES ('3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f', '9780307474728', 'Cien años de soledad',
                 'Gabriel García Márquez', 1, 0, 'cien anos', 'cien anos', now())`,
      )
      await dataSource.query(
        `INSERT INTO loans (id, book_id, borrower_email, loaned_at, due_at, returned_at)
         VALUES ('6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d', '3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f',
                 'ana@uc.cl', now(), now() + interval '14 days', NULL)`,
      )

      await dataSource.runMigrations()

      expect(await dataSource.query('SELECT renewal_count FROM loans')).toEqual([
        { renewal_count: 0 },
      ])
      expect(
        await rejectionOf(dataSource.query('UPDATE loans SET renewal_count = 2')),
      ).toMatchObject({ driverError: { code: '23514', constraint: 'ck_loans_renewal_count' } })
    })
  })
})
