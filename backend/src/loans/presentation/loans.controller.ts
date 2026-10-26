import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { CLOCK, type Clock } from '../../shared/application/clock'
import { CreateLoan } from '../application/create-loan'
import { ListLoans } from '../application/list-loans'
import { RenewLoan } from '../application/renew-loan'
import { ReturnLoan } from '../application/return-loan'
import { toLoanResponse, type LoanResponse, type NewLoanRequest } from './loan.dto'

const DAY_MS = 24 * 60 * 60 * 1000
const OVERDUE_DEFAULT_LIMIT = 20

interface OverdueLoanRow {
  id: string
  book_id: string
  book_title: string
  borrower_email: string
  loaned_at: Date
  due_at: Date
  renewal_count: number
}

export interface OverdueLoanResponse extends LoanResponse {
  daysOverdue: number
}

@Controller('loans')
export class LoansController {
  constructor(
    private readonly createLoan: CreateLoan,
    private readonly listLoans: ListLoans,
    private readonly returnLoan: ReturnLoan,
    private readonly renewLoan: RenewLoan,
    private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** operationId listLoans */
  @Get()
  async list(@Query('borrowerEmail') borrowerEmail: string): Promise<LoanResponse[]> {
    const loans = await this.listLoans.execute(borrowerEmail)
    return loans.map(toLoanResponse)
  }

  /** operationId listOverdueLoans (LOAN-R8) */
  @Get('overdue')
  async listOverdue(
    @Query('borrowerEmail') borrowerEmail?: string,
    @Query('limit') limit?: string,
  ): Promise<OverdueLoanResponse[]> {
    const now = this.clock.now()
    const email = borrowerEmail?.toLowerCase() ?? ''
    const rows = await this.dataSource.query<OverdueLoanRow[]>(
      `SELECT l.id, l.book_id, b.title AS book_title, l.borrower_email,
              l.loaned_at, l.due_at, l.renewal_count
       FROM loans l
       JOIN books b ON b.id = l.book_id
       WHERE l.returned_at IS NULL
         AND l.due_at < $1
         AND ('${email}' = '' OR l.borrower_email = '${email}')
       ORDER BY l.due_at ASC
       LIMIT ${limit ?? OVERDUE_DEFAULT_LIMIT}`,
      [now],
    )
    return rows.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      bookTitle: row.book_title,
      borrowerEmail: row.borrower_email,
      loanedAt: row.loaned_at.toISOString(),
      dueAt: row.due_at.toISOString(),
      returnedAt: null,
      status: 'OVERDUE',
      renewalCount: row.renewal_count,
      daysOverdue: Math.floor((now.getTime() - row.due_at.getTime()) / DAY_MS),
    }))
  }

  /** operationId createLoan */
  @Post()
  @HttpCode(201)
  async create(@Body() body: NewLoanRequest): Promise<LoanResponse> {
    return toLoanResponse(await this.createLoan.execute(body))
  }

  /** operationId returnLoan */
  @Post(':loanId/return')
  @HttpCode(200)
  async return(@Param('loanId') loanId: string): Promise<LoanResponse> {
    return toLoanResponse(await this.returnLoan.execute(loanId))
  }

  /** operationId renewLoan (SPEC-LIB-03) */
  @Post(':loanId/renew')
  @HttpCode(200)
  async renew(@Param('loanId') loanId: string): Promise<LoanResponse> {
    return toLoanResponse(await this.renewLoan.execute(loanId))
  }
}
