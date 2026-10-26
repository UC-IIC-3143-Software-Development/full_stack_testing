import { Module } from '@nestjs/common'
import { CheckHealth } from './application/check-health'
import { DATABASE_PROBE, type DatabaseProbe } from './application/database-probe'
import { TypeOrmDatabaseProbe } from './infrastructure/typeorm-database.probe'
import { HealthController } from './presentation/health.controller'

@Module({
  controllers: [HealthController],
  providers: [
    { provide: DATABASE_PROBE, useClass: TypeOrmDatabaseProbe },
    {
      provide: CheckHealth,
      useFactory: (probe: DatabaseProbe) => new CheckHealth(probe),
      inject: [DATABASE_PROBE],
    },
  ],
})
export class HealthModule {}
