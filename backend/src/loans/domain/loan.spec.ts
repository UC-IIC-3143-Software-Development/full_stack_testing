import { thrownBy } from '../../../test/support/errors'
import { Email } from './email'
import { Loan } from './loan'
import { AlreadyReturnedError } from './loan.errors'

function openLoan(now: string): Loan {
  return Loan.open({
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d',
    bookId: '3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f',
    bookTitle: 'Cien años de soledad',
    borrowerEmail: Email.create('ana@uc.cl'),
    now: new Date(now),
  })
}

describe('Loan', () => {
  describe('LOAN-R3 fecha de devolución', () => {
    it('[LOAN-R3] vence 14 días después de pedirlo', () => {
      expect(openLoan('2026-03-02T12:00:00.000Z').dueAt.toISOString()).toBe(
        '2026-03-16T12:00:00.000Z',
      )
    })

    it('[LOAN-R3] cruza el fin de febrero contando días reales', () => {
      expect(openLoan('2026-02-20T15:30:00.000Z').dueAt.toISOString()).toBe(
        '2026-03-06T15:30:00.000Z',
      )
    })
  })

  describe('LOAN-R5 devolución', () => {
    it('[LOAN-R5] registra la hora de devolución', () => {
      const returned = openLoan('2026-03-02T12:00:00.000Z').markReturned(
        new Date('2026-03-10T08:00:00.000Z'),
      )

      expect(returned.returnedAt?.toISOString()).toBe('2026-03-10T08:00:00.000Z')
    })

    it('[LOAN-R5] no se puede devolver dos veces', () => {
      const returned = openLoan('2026-03-02T12:00:00.000Z').markReturned(
        new Date('2026-03-10T08:00:00.000Z'),
      )

      expect(
        thrownBy(() => returned.markReturned(new Date('2026-03-11T08:00:00.000Z'))),
      ).toBeInstanceOf(AlreadyReturnedError)
    })
  })

  describe('LOAN-R6 estado calculado', () => {
    const loan = openLoan('2026-03-02T12:00:00.000Z') // vence 2026-03-16T12:00:00.000Z

    it('[LOAN-R6] está ACTIVE justo en el instante de vencimiento', () => {
      expect(loan.statusAt(new Date('2026-03-16T12:00:00.000Z'))).toBe('ACTIVE')
    })

    it('[LOAN-R6] está OVERDUE un milisegundo después del vencimiento', () => {
      expect(loan.statusAt(new Date('2026-03-16T12:00:00.001Z'))).toBe('OVERDUE')
    })

    it('[LOAN-R6] está RETURNED si se devolvió, aunque haya pasado la fecha', () => {
      const returned = loan.markReturned(new Date('2026-03-20T10:00:00.000Z'))

      expect(returned.statusAt(new Date('2026-04-01T00:00:00.000Z'))).toBe('RETURNED')
    })
  })
})
