// Casos de prueba de .semgrep/rules.yml (semgrep --test).
// "ruleid" marca una línea que DEBE detectarse y "ok" una que NO debe detectarse.
// semgrep --test no aplica los filtros de paths, por eso todos los casos viven aquí.
import { DataSource } from 'typeorm'

// ---------- biblioteca-usar-clock ----------
export function dueDate(loanedAt: Date): Date {
  // ok: biblioteca-usar-clock
  return new Date(loanedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
}

export function isOverdueWrong(dueAt: Date): boolean {
  // ruleid: biblioteca-usar-clock
  return Date.now() > dueAt.getTime()
}

export function todayWrong(): Date {
  // ruleid: biblioteca-usar-clock
  return new Date()
}

export function isOverdue(dueAt: Date, clock: { now(): Date }): boolean {
  // ok: biblioteca-usar-clock
  return clock.now().getTime() > dueAt.getTime()
}

// ---------- biblioteca-sql-concatenado ----------
export async function searchWrong(db: DataSource, q: string) {
  // ruleid: biblioteca-sql-concatenado
  return db.query(`SELECT * FROM book WHERE title ILIKE '%${q}%'`)
}

export async function searchGenericWrong(db: DataSource, email: string) {
  // ruleid: biblioteca-sql-concatenado
  return db.query<{ id: string }[]>(`SELECT id FROM loans WHERE borrower_email = '${email}'`, [])
}

export async function overdueWrong(db: DataSource, email: string) {
  // ruleid: biblioteca-sql-concatenado
  const rows = await db.query<{ id: string }[]>(
    `SELECT id FROM loans
     WHERE borrower_email = '${email}'`,
    [],
  )
  return rows
}

export async function searchConcatWrong(db: DataSource, q: string) {
  // ruleid: biblioteca-sql-concatenado
  return db.query("SELECT * FROM book WHERE title = '" + q)
}

export async function searchBuilderWrong(db: DataSource, q: string) {
  const qb = db.createQueryBuilder()
  // ruleid: biblioteca-sql-concatenado
  return qb.where(`book.title ILIKE '%${q}%'`).getMany()
}

const SELECT_BOOKS = 'SELECT id, title FROM book'

export async function findById(db: DataSource, id: string) {
  // ok: biblioteca-sql-concatenado
  return db.query(`${SELECT_BOOKS} WHERE id = $1`, [id])
}

export async function search(db: DataSource, q: string) {
  // ok: biblioteca-sql-concatenado
  return db.query('SELECT * FROM book WHERE unaccent(title) ILIKE unaccent($1)', [`%${q}%`])
}

export async function searchBuilder(db: DataSource, q: string) {
  const qb = db.createQueryBuilder()
  // ok: biblioteca-sql-concatenado
  return qb.where('book.title ILIKE :q', { q: `%${q}%` }).getMany()
}

// ---------- biblioteca-no-console-log ----------
export function debugWrong(value: unknown) {
  // ruleid: biblioteca-no-console-log
  console.log('valor', value)
}

export function reportError(error: Error) {
  // ok: biblioteca-no-console-log
  console.error(error.message)
}
