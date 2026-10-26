import { Global, Module, type OnApplicationShutdown } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { UNIT_OF_WORK } from '../shared/application/unit-of-work'
import { APP_CONFIG, type AppConfig } from '../shared/infrastructure/config/app-config'
import { TypeOrmUnitOfWork } from '../shared/infrastructure/database/typeorm-unit-of-work'
import { createDataSource } from './data-source'

@Global()
@Module({
  providers: [
    {
      provide: DataSource,
      // Si DB_RUN_MIGRATIONS no es "false", las migraciones corren al iniciar la app.
      useFactory: (config: AppConfig) =>
        createDataSource({
          databaseUrl: config.databaseUrl,
          runMigrations: config.runMigrations,
        }).initialize(),
      inject: [APP_CONFIG],
    },
    TypeOrmUnitOfWork,
    { provide: UNIT_OF_WORK, useExisting: TypeOrmUnitOfWork },
  ],
  exports: [DataSource, TypeOrmUnitOfWork, UNIT_OF_WORK],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy()
    }
  }
}
