import { thrownBy } from '../../../test/support/errors'
import { Email } from './email'
import { Loan } from './loan'
import { DuplicateLoanError, LoanLimitReachedError } from './loan.errors'
import { assertCanBorrow } from './loan-policy'

const ana = Email.create('ana@uc.cl')
const NEW_BOOK = '99999999-9999-4999-8999-999999999999'

function loanOf(bookId: string, loanedAt = '2026-03-02T12:00:00.000Z'): Loan {
  return Loan.open({
    id: `${bookId.slice(0, 8)}-0000-4000-8000-000000000000`,
    bookId,
    bookTitle: 'Libro',
    borrowerEmail: ana,
    now: new Date(loanedAt),
  })
}

const BOOK_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BOOK_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BOOK_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('assertCanBorrow', () => {
  describe('LOAN-R2 máximo 3 préstamos no devueltos', () => {
    it('[LOAN-R2] permite el tercer préstamo', () => {
      expect(() => assertCanBorrow(ana, [loanOf(BOOK_A), loanOf(BOOK_B)], NEW_BOOK)).not.toThrow()
    })

    it('[LOAN-R2] rechaza el cuarto préstamo', () => {
      const error = thrownBy(() =>
        assertCanBorrow(ana, [loanOf(BOOK_A), loanOf(BOOK_B), loanOf(BOOK_C)], NEW_BOOK),
      )

      expect(error).toBeInstanceOf(LoanLimitReachedError)
      expect(error).toMatchObject({ message: 'ana@uc.cl ya tiene 3 préstamos activos' })
    })

    it('[LOAN-R2] los préstamos vencidos también cuentan', () => {
      const overdue = [BOOK_A, BOOK_B, BOOK_C].map((id) => loanOf(id, '2026-01-01T12:00:00.000Z'))

      expect(thrownBy(() => assertCanBorrow(ana, overdue, NEW_BOOK))).toBeInstanceOf(
        LoanLimitReachedError,
      )
    })

    it('[LOAN-R2] los préstamos devueltos no cuentan', () => {
      const returned = [BOOK_A, BOOK_B, BOOK_C].map((id) =>
        loanOf(id).markReturned(new Date('2026-03-03T12:00:00.000Z')),
      )

      expect(() => assertCanBorrow(ana, returned, NEW_BOOK)).not.toThrow()
    })
  })

  describe('LOAN-R4 sin duplicados', () => {
    it('[LOAN-R4] rechaza pedir un libro que la persona aún no devuelve', () => {
      expect(thrownBy(() => assertCanBorrow(ana, [loanOf(BOOK_A)], BOOK_A))).toBeInstanceOf(
        DuplicateLoanError,
      )
    })

    it('[LOAN-R4] permite pedir de nuevo un libro ya devuelto', () => {
      const returned = loanOf(BOOK_A).markReturned(new Date('2026-03-03T12:00:00.000Z'))

      expect(() => assertCanBorrow(ana, [returned], BOOK_A)).not.toThrow()
    })
  })
})
