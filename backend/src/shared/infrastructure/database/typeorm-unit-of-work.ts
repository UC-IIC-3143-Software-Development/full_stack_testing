import { AsyncLocalStorage } from 'node:async_hooks'
import { Injectable } from '@nestjs/common'
import { DataSource, EntityManager } from 'typeorm'
import type { UnitOfWork } from '../../application/unit-of-work'

/**
 * Unidad de trabajo con PostgreSQL. Abre una transacción y guarda su EntityManager en
 * un AsyncLocalStorage: los repositorios llaman a `manager()` y, sin saberlo, participan
 * de la transacción en curso. Así los casos de uso no conocen TypeORM.
 */
@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  private readonly storage = new AsyncLocalStorage<EntityManager>()

  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) {
      return work()
    }
    return this.dataSource.transaction((manager) => this.storage.run(manager, work))
  }

  /** EntityManager de la transacción en curso o, si no hay, el de la conexión. */
  manager(): EntityManager {
    return this.storage.getStore() ?? this.dataSource.manager
  }
}
