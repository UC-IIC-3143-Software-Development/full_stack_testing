import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Entidad de persistencia (no es la entidad de dominio). Los índices y las restricciones
 * CHECK no se declaran aquí: viven en la migración, que es la fuente de verdad del esquema.
 */
@Entity({ name: 'books' })
export class BookOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string

  @Column({ type: 'varchar', length: 13 })
  isbn: string

  @Column({ type: 'varchar', length: 200 })
  title: string

  @Column({ type: 'varchar', length: 120 })
  author: string

  @Column({ name: 'total_copies', type: 'integer' })
  totalCopies: number

  @Column({ name: 'available_copies', type: 'integer' })
  availableCopies: number

  @Column({ name: 'search_key', type: 'text' })
  searchKey: string

  @Column({ name: 'title_key', type: 'text' })
  titleKey: string

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
