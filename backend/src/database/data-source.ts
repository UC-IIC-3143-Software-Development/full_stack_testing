import { DataSource } from 'typeorm'
import { BookOrmEntity } from '../books/infrastructure/book.orm-entity'
import { LoanOrmEntity } from '../loans/infrastructure/loan.orm-entity'
import { InitialSchema1792972800000 } from './migrations/1792972800000-initial-schema'
import { AddLoanRenewalCount1793016000000 } from './migrations/1793016000000-add-loan-renewal-count'

export interface DataSourceSettings {
  databaseUrl: string
  runMigrations?: boolean
}

/**
 * Raíz de composición de la persistencia: junta las entidades de cada módulo y las
 * migraciones. La usan la app, el script migration:run y los tests de integración.
 * synchronize queda en false: el esquema solo cambia con migraciones revisadas en un PR.
 */
export function createDataSource({ databaseUrl, runMigrations = false }: DataSourceSettings) {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [BookOrmEntity, LoanOrmEntity],
    migrations: [InitialSchema1792972800000, AddLoanRenewalCount1793016000000],
    migrationsTableName: 'migrations',
    migrationsRun: runMigrations,
    synchronize: false,
    logging: false,
  })
}
