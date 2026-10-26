import type { BookRepository } from '../../src/books/application/book.repository'
import type { Book } from '../../src/books/domain/book'
import type { LoanRepository } from '../../src/loans/application/loan.repository'
import { Email } from '../../src/loans/domain/email'
import { DuplicateLoanError } from '../../src/loans/domain/loan.errors'
import { aBook, aLoan, CATALOG, FIXED_NOW } from '../support/test-data'

export interface LoanRepositories {
  books: BookRepository
  loans: LoanRepository
}

/**
 * Suite de contrato del puerto LoanRepository. Misma idea que bookRepositoryContract:
 * corre contra el fake en memoria (unit) y contra PostgreSQL (integration).
 */
export function loanRepositoryContract(
  implementation: string,
  createRepositories: () => Promise<LoanRepositories>,
): void {
  describe(`Contrato de LoanRepository: ${implementation}`, () => {
    let loans: LoanRepository
    let cienAnos: Book
    let ficciones: Book

    beforeEach(async () => {
      const repositories = await createRepositories()
      loans = repositories.loans
      cienAnos = aBook(CATALOG.cienAnos, 3)
      ficciones = aBook(CATALOG.ficciones, 2)
      await repositories.books.add(cienAnos)
      await repositories.books.add(ficciones)
    })

    it('[LOAN-R4] rechaza un segundo préstamo no devuelto del mismo libro y la misma persona', async () => {
      await loans.add(aLoan(cienAnos, 'ana@uc.cl'))

      await expect(loans.add(aLoan(cienAnos, 'ana@uc.cl'))).rejects.toThrow(DuplicateLoanError)
    })

    it('[LOAN-R4] permite pedir de nuevo el mismo libro después de devolverlo', async () => {
      const first = aLoan(cienAnos, 'ana@uc.cl')
      await loans.add(first)
      await loans.markReturned(first.markReturned(new Date(FIXED_NOW)))

      await loans.add(aLoan(cienAnos, 'ana@uc.cl'))

      expect(await loans.findByBorrower(Email.create('ana@uc.cl'))).toHaveLength(2)
    })

    it('[LOAN-R2] entrega solo los préstamos no devueltos de la persona', async () => {
      const returned = aLoan(cienAnos, 'ana@uc.cl')
      const active = aLoan(ficciones, 'ana@uc.cl')
      await loans.add(returned)
      await loans.add(active)
      await loans.add(aLoan(cienAnos, 'beto@uc.cl'))
      await loans.markReturned(returned.markReturned(new Date(FIXED_NOW)))

      const unreturned = await loans.findUnreturnedByBorrower(Email.create('ana@uc.cl'))

      expect(unreturned.map((loan) => loan.id)).toEqual([active.id])
    })

    it('[LOAN-R5] guarda la devolución una sola vez', async () => {
      const loan = aLoan(ficciones, 'ana@uc.cl')
      await loans.add(loan)
      const returned = loan.markReturned(new Date('2026-03-05T09:30:00.000Z'))

      expect(await loans.markReturned(returned)).toBe(true)
      expect(await loans.markReturned(returned)).toBe(false)
      expect((await loans.findById(loan.id))?.returnedAt).toEqual(
        new Date('2026-03-05T09:30:00.000Z'),
      )
    })

    it('[RENEW-R2] guarda la renovación una sola vez y la entrega al leer', async () => {
      const loan = aLoan(cienAnos, 'ana@uc.cl')
      await loans.add(loan)
      const renewed = loan.renew(new Date(FIXED_NOW))

      expect(await loans.markRenewed(renewed)).toBe(true)
      expect(await loans.markRenewed(renewed)).toBe(false)
      const stored = await loans.findById(loan.id)
      expect([stored?.dueAt.toISOString(), stored?.renewalCount]).toEqual([
        '2026-03-23T12:00:00.000Z',
        1,
      ])
    })

    it('[LOAN-R7] busca por correo normalizado y ordena del más reciente al más antiguo', async () => {
      const older = aLoan(cienAnos, 'ana@uc.cl', '2026-03-01T10:00:00.000Z')
      const newer = aLoan(ficciones, 'ana@uc.cl', '2026-03-02T10:00:00.000Z')
      await loans.add(older)
      await loans.add(newer)

      const found = await loans.findByBorrower(Email.create('  ANA@UC.CL '))

      expect(found.map((loan) => [loan.bookTitle, loan.dueAt.toISOString()])).toEqual([
        ['Ficciones', '2026-03-16T10:00:00.000Z'],
        ['Cien años de soledad', '2026-03-15T10:00:00.000Z'],
      ])
    })
  })
}
