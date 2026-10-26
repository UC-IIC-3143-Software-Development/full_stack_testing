import { Injectable } from '@nestjs/common'
import { isUniqueViolation } from '../../shared/infrastructure/database/postgres-errors'
import { TypeOrmUnitOfWork } from '../../shared/infrastructure/database/typeorm-unit-of-work'
import type { LoanRepository } from '../application/loan.repository'
import { Email } from '../domain/email'
import { Loan } from '../domain/loan'
import { DuplicateLoanError } from '../domain/loan.errors'
import { LoanOrmEntity } from './loan.orm-entity'

/** Índice único parcial creado en la migración (LOAN-R4). */
export const LOANS_UNRETURNED_UNIQUE = 'uq_loans_unreturned_book_borrower'

/** Espacio de nombres de los advisory locks de préstamos (cualquier entero fijo sirve). */
const BORROWER_LOCK_NAMESPACE = 3143

interface LoanRow {
  id: string
  book_id: string
  book_title: string
  borrower_email: string
  loaned_at: Date
  due_at: Date
  returned_at: Date | null
}

// El título viene de la tabla books con un JOIN en SQL: el módulo loans no importa
// la infraestructura de books (ARCH-R5).
const SELECT_LOANS = `
  SELECT l.id, l.book_id, b.title AS book_title, l.borrower_email,
         l.loaned_at, l.due_at, l.returned_at
  FROM loans l
  JOIN books b ON b.id = l.book_id`

@Injectable()
export class TypeOrmLoanRepository implements LoanRepository {
  constructor(private readonly unitOfWork: TypeOrmUnitOfWork) {}

  private get manager() {
    return this.unitOfWork.manager()
  }

  async lockBorrower(borrowerEmail: Email): Promise<void> {
    // LOAN-R2: el lock dura hasta el fin de la transacción. Dos préstamos simultáneos
    // de la misma persona se ejecutan uno después del otro.
    await this.manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
      BORROWER_LOCK_NAMESPACE,
      borrowerEmail.value,
    ])
  }

  async add(loan: Loan): Promise<void> {
    try {
      await this.manager.getRepository(LoanOrmEntity).insert({
        id: loan.id,
        bookId: loan.bookId,
        borrowerEmail: loan.borrowerEmail.value,
        loanedAt: loan.loanedAt,
        dueAt: loan.dueAt,
        returnedAt: loan.returnedAt,
      })
    } catch (error) {
      if (isUniqueViolation(error, LOANS_UNRETURNED_UNIQUE)) {
        throw new DuplicateLoanError(loan.borrowerEmail.value)
      }
      throw error
    }
  }

  async findById(id: string): Promise<Loan | null> {
    const rows: LoanRow[] = await this.manager.query(`${SELECT_LOANS} WHERE l.id = $1`, [id])
    return rows.length > 0 ? toDomain(rows[0]) : null
  }

  async findByBorrower(borrowerEmail: Email): Promise<Loan[]> {
    const rows: LoanRow[] = await this.manager.query(
      `${SELECT_LOANS} WHERE l.borrower_email = $1 ORDER BY l.loaned_at DESC, l.id`,
      [borrowerEmail.value],
    )
    return rows.map(toDomain)
  }

  async findUnreturnedByBorrower(borrowerEmail: Email): Promise<Loan[]> {
    const rows: LoanRow[] = await this.manager.query(
      `${SELECT_LOANS} WHERE l.borrower_email = $1 AND l.returned_at IS NULL ORDER BY l.loaned_at DESC, l.id`,
      [borrowerEmail.value],
    )
    return rows.map(toDomain)
  }

  async markReturned(loan: Loan): Promise<boolean> {
    // UPDATE condicional: si otra transacción ya lo devolvió, afecta 0 filas (LOAN-R5).
    const result = await this.manager
      .getRepository(LoanOrmEntity)
      .createQueryBuilder()
      .update(LoanOrmEntity)
      .set({ returnedAt: loan.returnedAt })
      .where('id = :id AND returned_at IS NULL', { id: loan.id })
      .execute()
    return result.affected === 1
  }

  async markRenewed(): Promise<boolean> {
    throw new Error('markRenewed aún no está implementado (SPEC-LIB-03)')
  }
}

function toDomain(row: LoanRow): Loan {
  return Loan.restore({
    id: row.id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    borrowerEmail: Email.create(row.borrower_email),
    loanedAt: row.loaned_at,
    dueAt: row.due_at,
    returnedAt: row.returned_at,
  })
}
