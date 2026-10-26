import type { Clock } from '../../shared/application/clock'
import type { UnitOfWork } from '../../shared/application/unit-of-work'
import type { LoanRepository } from './loan.repository'
import type { LoanDetails } from './loan-details'

/** Caso de uso: renovar un préstamo (SPEC-LIB-03). SDD rojo: todavía sin implementar. */
export class RenewLoan {
  constructor(_loans: LoanRepository, _unitOfWork: UnitOfWork, _clock: Clock) {}

  async execute(_loanId: string): Promise<LoanDetails> {
    throw new Error('RenewLoan aún no está implementado (SPEC-LIB-03)')
  }
}
