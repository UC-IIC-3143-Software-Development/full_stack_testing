import { Column, Entity, PrimaryColumn } from 'typeorm'

/** Entidad de persistencia de préstamos. La FK, los índices y el CHECK están en la migración. */
@Entity({ name: 'loans' })
export class LoanOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string

  @Column({ name: 'book_id', type: 'uuid' })
  bookId: string

  @Column({ name: 'borrower_email', type: 'varchar', length: 254 })
  borrowerEmail: string

  @Column({ name: 'loaned_at', type: 'timestamptz' })
  loanedAt: Date

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date

  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true })
  returnedAt: Date | null
}
