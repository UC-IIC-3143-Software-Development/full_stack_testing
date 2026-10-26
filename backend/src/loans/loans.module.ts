import { Module } from '@nestjs/common'
import { BOOK_REPOSITORY, type BookRepository } from '../books/application/book.repository'
import { BooksModule } from '../books/books.module'
import { CLOCK, type Clock } from '../shared/application/clock'
import { UNIT_OF_WORK, type UnitOfWork } from '../shared/application/unit-of-work'
import { CreateLoan } from './application/create-loan'
import { ListLoans } from './application/list-loans'
import { LOAN_REPOSITORY, type LoanRepository } from './application/loan.repository'
import { RenewLoan } from './application/renew-loan'
import { ReturnLoan } from './application/return-loan'
import { TypeOrmLoanRepository } from './infrastructure/typeorm-loan.repository'
import { LoansController } from './presentation/loans.controller'

@Module({
  imports: [BooksModule],
  controllers: [LoansController],
  providers: [
    { provide: LOAN_REPOSITORY, useClass: TypeOrmLoanRepository },
    {
      provide: CreateLoan,
      useFactory: (books: BookRepository, loans: LoanRepository, uow: UnitOfWork, clock: Clock) =>
        new CreateLoan(books, loans, uow, clock),
      inject: [BOOK_REPOSITORY, LOAN_REPOSITORY, UNIT_OF_WORK, CLOCK],
    },
    {
      provide: ListLoans,
      useFactory: (loans: LoanRepository, clock: Clock) => new ListLoans(loans, clock),
      inject: [LOAN_REPOSITORY, CLOCK],
    },
    {
      provide: ReturnLoan,
      useFactory: (books: BookRepository, loans: LoanRepository, uow: UnitOfWork, clock: Clock) =>
        new ReturnLoan(books, loans, uow, clock),
      inject: [BOOK_REPOSITORY, LOAN_REPOSITORY, UNIT_OF_WORK, CLOCK],
    },
    {
      provide: RenewLoan,
      useFactory: (loans: LoanRepository, uow: UnitOfWork, clock: Clock) =>
        new RenewLoan(loans, uow, clock),
      inject: [LOAN_REPOSITORY, UNIT_OF_WORK, CLOCK],
    },
  ],
})
export class LoansModule {}
