import { databaseUrl } from '../../test/support/database'
import { createDataSource } from './data-source'

describe('Migraciones (Testcontainers)', () => {
  it('[BOOK-R2] [BOOK-R4] [LOAN-R4] crean tablas, índices y restricciones, y se pueden revertir', async () => {
    // Base de datos aparte para no interferir con los otros tests de integración.
    const admin = await createDataSource({ databaseUrl: databaseUrl() }).initialize()
    await admin.query('DROP DATABASE IF EXISTS migrations_check')
    await admin.query('CREATE DATABASE migrations_check')
    const url = new URL(databaseUrl())
    url.pathname = '/migrations_check'
    const dataSource = await createDataSource({ databaseUrl: url.toString() }).initialize()

    try {
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
      const tables: { tablename: string }[] = await dataSource.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      )
      expect(tables.map((row) => row.tablename)).toEqual(['migrations'])
    } finally {
      await dataSource.destroy()
      await admin.query('DROP DATABASE migrations_check')
      await admin.destroy()
    }
  })
})
