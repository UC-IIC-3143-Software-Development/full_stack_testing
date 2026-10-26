import type { Email } from '../domain/email'
import type { Loan } from '../domain/loan'

/**
 * Puerto del repositorio de préstamos. Implementaciones: TypeOrmLoanRepository y
 * InMemoryLoanRepository. Ambas pasan test/repository-contract/loan-repository.contract.ts
 */
export interface LoanRepository {
  /**
   * Serializa los préstamos de una misma persona dentro de la transacción en curso,
   * para que LOAN-R2 se cumpla aunque lleguen dos solicitudes a la vez.
   */
  lockBorrower(borrowerEmail: Email): Promise<void>
  /** Guarda un préstamo nuevo. Lanza DuplicateLoanError si ya hay uno no devuelto del mismo libro (LOAN-R4). */
  add(loan: Loan): Promise<void>
  findById(id: string): Promise<Loan | null>
  /** Préstamos de la persona, del más reciente al más antiguo. */
  findByBorrower(borrowerEmail: Email): Promise<Loan[]>
  /** Préstamos no devueltos (activos o vencidos) de la persona (LOAN-R2 y LOAN-R4). */
  findUnreturnedByBorrower(borrowerEmail: Email): Promise<Loan[]>
  /** Guarda la devolución solo si el préstamo seguía sin devolver. Devuelve false si ya estaba devuelto (LOAN-R5). */
  markReturned(loan: Loan): Promise<boolean>
  /**
   * Guarda dueAt y renewalCount de un préstamo renovado solo si sigue sin devolver y nadie lo
   * renovó antes. Devuelve false si otra solicitud lo cambió primero (RENEW-R2 y RENEW-R3).
   */
  markRenewed(loan: Loan): Promise<boolean>
}

export const LOAN_REPOSITORY = Symbol('LoanRepository')
