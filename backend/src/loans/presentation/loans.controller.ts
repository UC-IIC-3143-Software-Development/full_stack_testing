import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { CreateLoan } from '../application/create-loan'
import { ListLoans } from '../application/list-loans'
import { ReturnLoan } from '../application/return-loan'
import { toLoanResponse, type LoanResponse, type NewLoanRequest } from './loan.dto'

@Controller('loans')
export class LoansController {
  constructor(
    private readonly createLoan: CreateLoan,
    private readonly listLoans: ListLoans,
    private readonly returnLoan: ReturnLoan,
  ) {}

  /** operationId listLoans */
  @Get()
  async list(@Query('borrowerEmail') borrowerEmail: string): Promise<LoanResponse[]> {
    const loans = await this.listLoans.execute(borrowerEmail)
    return loans.map(toLoanResponse)
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
}
