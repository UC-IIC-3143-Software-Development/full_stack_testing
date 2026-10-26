import { bookRepositoryContract } from '../repository-contract/book-repository.contract'
import { loanRepositoryContract } from '../repository-contract/loan-repository.contract'
import { InMemoryBookRepository } from './in-memory-book.repository'
import { InMemoryLoanRepository } from './in-memory-loan.repository'

// Los fakes pasan el mismo contrato que los repositorios de PostgreSQL
// (ver src/**/infrastructure/*.int-spec.ts). Así sabemos que no mienten.
bookRepositoryContract('fake en memoria', async () => new InMemoryBookRepository())

loanRepositoryContract('fake en memoria', async () => ({
  books: new InMemoryBookRepository(),
  loans: new InMemoryLoanRepository(),
}))
