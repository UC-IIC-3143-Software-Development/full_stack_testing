import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { DatabaseProbe } from '../application/database-probe'

@Injectable()
export class TypeOrmDatabaseProbe implements DatabaseProbe {
  constructor(private readonly dataSource: DataSource) {}

  async ping(): Promise<void> {
    await this.dataSource.query('SELECT 1')
  }
}
