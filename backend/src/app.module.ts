import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { BooksModule } from './books/books.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { LoansModule } from './loans/loans.module'
import { OpenApiValidationMiddleware } from './shared/presentation/openapi/openapi-validation.middleware'
import { ProblemDetailsFilter } from './shared/presentation/problem-details.filter'
import { SharedModule } from './shared/shared.module'

@Module({
  imports: [SharedModule, DatabaseModule, HealthModule, BooksModule, LoansModule],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(OpenApiValidationMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}
