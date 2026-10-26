import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Esquema inicial. Las reglas que la base de datos debe garantizar aunque falle el código
 * (data testing) se escriben aquí de forma explícita:
 *
 * - BOOK-R2: índice único en isbn.
 * - BOOK-R4: CHECK 1 <= total_copies <= 50 y 0 <= available_copies <= total_copies.
 * - BOOK-R5: search_key y title_key se guardan ya normalizados por el dominio.
 *   COLLATE "C" hace que el orden sea el mismo en cualquier sistema operativo.
 * - LOAN-R4: índice único parcial (book_id, borrower_email) solo para préstamos no devueltos.
 */
export class InitialSchema1792972800000 implements MigrationInterface {
  name = 'InitialSchema1792972800000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE books (
        id               uuid PRIMARY KEY,
        isbn             varchar(13)  NOT NULL,
        title            varchar(200) NOT NULL,
        author           varchar(120) NOT NULL,
        total_copies     integer      NOT NULL,
        available_copies integer      NOT NULL,
        search_key       text COLLATE "C" NOT NULL,
        title_key        text COLLATE "C" NOT NULL,
        created_at       timestamptz  NOT NULL,
        CONSTRAINT ck_books_total_copies CHECK (total_copies BETWEEN 1 AND 50),
        CONSTRAINT ck_books_available_copies
          CHECK (available_copies >= 0 AND available_copies <= total_copies)
      )`)
    await queryRunner.query(`CREATE UNIQUE INDEX uq_books_isbn ON books (isbn)`)
    await queryRunner.query(`CREATE INDEX ix_books_title_key ON books (title_key, id)`)

    await queryRunner.query(`
      CREATE TABLE loans (
        id             uuid PRIMARY KEY,
        book_id        uuid         NOT NULL,
        borrower_email varchar(254) NOT NULL,
        loaned_at      timestamptz  NOT NULL,
        due_at         timestamptz  NOT NULL,
        returned_at    timestamptz  NULL,
        CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books (id)
      )`)
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_loans_unreturned_book_borrower
        ON loans (book_id, borrower_email)
        WHERE returned_at IS NULL`)
    await queryRunner.query(
      `CREATE INDEX ix_loans_borrower ON loans (borrower_email, loaned_at DESC)`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE loans`)
    await queryRunner.query(`DROP TABLE books`)
  }
}
