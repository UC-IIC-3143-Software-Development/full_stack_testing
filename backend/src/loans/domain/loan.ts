import { AlreadyReturnedError, LoanOverdueError, RenewalLimitReachedError } from './loan.errors'
import type { Email } from './email'

export const LOAN_DURATION_DAYS = 14
export const RENEWAL_DAYS = 7
export const MAX_RENEWALS = 1
const DAY_IN_MS = 24 * 60 * 60 * 1000

export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'RETURNED'

export interface LoanProps {
  id: string
  bookId: string
  bookTitle: string
  borrowerEmail: Email
  loanedAt: Date
  dueAt: Date
  returnedAt: Date | null
  /** Veces que se renovó (RENEW-R2). Un préstamo nuevo parte en 0. */
  renewalCount: number
}

export interface OpenLoanInput {
  id: string
  bookId: string
  bookTitle: string
  borrowerEmail: Email
  now: Date
}

/** Entidad Loan. Inmutable. El estado no se guarda: se calcula con la hora actual (LOAN-R6). */
export class Loan {
  private constructor(private readonly props: LoanProps) {}

  /** LOAN-R3: dueAt = loanedAt + 14 días. */
  static open(input: OpenLoanInput): Loan {
    return new Loan({
      id: input.id,
      bookId: input.bookId,
      bookTitle: input.bookTitle,
      borrowerEmail: input.borrowerEmail,
      loanedAt: input.now,
      dueAt: new Date(input.now.getTime() + LOAN_DURATION_DAYS * DAY_IN_MS),
      returnedAt: null,
      renewalCount: 0,
    })
  }

  static restore(props: LoanProps): Loan {
    return new Loan({ ...props })
  }

  get id(): string {
    return this.props.id
  }
  get bookId(): string {
    return this.props.bookId
  }
  get bookTitle(): string {
    return this.props.bookTitle
  }
  get borrowerEmail(): Email {
    return this.props.borrowerEmail
  }
  get loanedAt(): Date {
    return this.props.loanedAt
  }
  get dueAt(): Date {
    return this.props.dueAt
  }
  get returnedAt(): Date | null {
    return this.props.returnedAt
  }
  get isReturned(): boolean {
    return this.props.returnedAt !== null
  }
  get renewalCount(): number {
    return this.props.renewalCount
  }

  /** LOAN-R5: registra la devolución. Si ya estaba devuelto, AlreadyReturnedError. */
  markReturned(now: Date): Loan {
    if (this.isReturned) {
      throw new AlreadyReturnedError(this.props.id)
    }
    return new Loan({ ...this.props, returnedAt: now })
  }

  /**
   * SPEC-LIB-03: suma 7 días a dueAt (no a now) e incrementa renewalCount (RENEW-R1).
   * Orden de las reglas: devuelto (RENEW-R3), ya renovado (RENEW-R2) y vencido (RENEW-R3).
   * Renovar justo en dueAt está permitido: vencido es now > dueAt, igual que en LOAN-R6.
   */
  renew(now: Date): Loan {
    if (this.isReturned) {
      throw new AlreadyReturnedError(this.props.id)
    }
    if (this.props.renewalCount >= MAX_RENEWALS) {
      throw new RenewalLimitReachedError(this.props.id)
    }
    if (this.statusAt(now) === 'OVERDUE') {
      throw new LoanOverdueError(this.props.id)
    }
    return new Loan({
      ...this.props,
      dueAt: new Date(this.props.dueAt.getTime() + RENEWAL_DAYS * DAY_IN_MS),
      renewalCount: this.props.renewalCount + 1,
    })
  }

  /** LOAN-R6: RETURNED si se devolvió, OVERDUE si now es posterior a dueAt, ACTIVE si no. */
  statusAt(now: Date): LoanStatus {
    if (this.isReturned) {
      return 'RETURNED'
    }
    return now.getTime() > this.props.dueAt.getTime() ? 'OVERDUE' : 'ACTIVE'
  }
}
