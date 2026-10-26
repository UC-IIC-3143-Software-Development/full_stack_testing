import type { Book } from '@/shared/api/types'
import { formatIsbn } from '@/shared/domain/isbn'
import { AvailabilityBadge } from './AvailabilityBadge'
import styles from './BookDetail.module.css'

/** Ficha de un libro en /libros/[id]. */
export function BookDetail({ book }: { book: Book }) {
  return (
    <section className={styles.detail} aria-labelledby="book-title">
      <div className={styles.heading}>
        <h1 id="book-title">{book.title}</h1>
        <AvailabilityBadge availableCopies={book.availableCopies} />
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Autor</dt>
          <dd>{book.author}</dd>
        </div>
        <div>
          <dt>ISBN</dt>
          <dd>{formatIsbn(book.isbn)}</dd>
        </div>
        <div>
          <dt>Copias</dt>
          <dd>
            {book.availableCopies} de {book.totalCopies} disponibles
          </dd>
        </div>
      </dl>
    </section>
  )
}
