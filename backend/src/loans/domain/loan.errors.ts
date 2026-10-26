import { DomainError } from '../../shared/domain/domain-error'

/** LOAN-R2: la persona ya tiene el máximo de préstamos no devueltos. */
export class LoanLimitReachedError extends DomainError {
  readonly code = 'LOAN_LIMIT_REACHED'

  constructor(borrowerEmail: string, limit: number) {
    super(`${borrowerEmail} ya tiene ${limit} préstamos activos`)
  }
}

/** LOAN-R4: la persona ya tiene un préstamo no devuelto de este libro. */
export class DuplicateLoanError extends DomainError {
  readonly code = 'DUPLICATE_LOAN'

  constructor(borrowerEmail: string) {
    super(`${borrowerEmail} ya tiene un préstamo activo de este libro`)
  }
}

/** LOAN-R5: el préstamo ya fue devuelto. */
export class AlreadyReturnedError extends DomainError {
  readonly code = 'ALREADY_RETURNED'

  constructor(readonly loanId: string) {
    super('El préstamo ya fue devuelto')
  }
}

/** LOAN-R5: el préstamo no existe. */
export class LoanNotFoundError extends DomainError {
  readonly code = 'LOAN_NOT_FOUND'

  constructor(readonly loanId: string) {
    super('No existe el préstamo solicitado')
  }
}
