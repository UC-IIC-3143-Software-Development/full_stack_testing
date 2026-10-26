import type { Clock } from '../../shared/application/clock'
import type { UnitOfWork } from '../../shared/application/unit-of-work'
import {
  AlreadyReturnedError,
  LoanNotFoundError,
  RenewalLimitReachedError,
} from '../domain/loan.errors'
import type { LoanRepository } from './loan.repository'
import { toLoanDetails, type LoanDetails } from './loan-details'

/** Caso de uso: renovar un préstamo por 7 días (SPEC-LIB-03). */
export class RenewLoan {
  constructor(
    private readonly loans: LoanRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(loanId: string): Promise<LoanDetails> {
    const now = this.clock.now()

    const renewed = await this.unitOfWork.run(async () => {
      const loan = await this.loans.findById(loanId)
      if (!loan) {
        throw new LoanNotFoundError(loanId) // RENEW-R4
      }
      const renewedLoan = loan.renew(now) // RENEW-R1, RENEW-R2 y RENEW-R3 en el dominio
      if (!(await this.loans.markRenewed(renewedLoan))) {
        // Otra solicitud lo renovó o lo devolvió primero. Se vuelve a leer para saber cuál.
        const current = await this.loans.findById(loanId)
        throw current?.isReturned
          ? new AlreadyReturnedError(loanId)
          : new RenewalLimitReachedError(loanId)
      }
      return renewedLoan
    })

    return toLoanDetails(renewed, now)
  }
}
