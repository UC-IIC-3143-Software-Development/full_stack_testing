import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { CreateLoan } from '../application/create-loan'
import { ListLoans } from '../application/list-loans'
import { RenewLoan } from '../application/renew-loan'
import { ReturnLoan } from '../application/return-loan'
import { toLoanResponse, type LoanResponse, type NewLoanRequest } from './loan.dto'

@Controller('loans')
export class LoansController {
  constructor(
    private readonly createLoan: CreateLoan,
    private readonly listLoans: ListLoans,
    private readonly returnLoan: ReturnLoan,
    private readonly renewLoan: RenewLoan,
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

  /** operationId renewLoan (SPEC-LIB-03) */
  @Post(':loanId/renew')
  @HttpCode(200)
  async renew(@Param('loanId') loanId: string): Promise<LoanResponse> {
    return toLoanResponse(await this.renewLoan.execute(loanId))
  }
}
