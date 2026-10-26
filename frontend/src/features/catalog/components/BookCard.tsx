import Link from 'next/link'
import { useId } from 'react'
import type { Book } from '@/shared/api/types'
import { formatIsbn } from '@/shared/domain/isbn'
import { AvailabilityBadge } from './AvailabilityBadge'
import styles from './BookCard.module.css'

/** UI-CAT-1 a UI-CAT-3: tarjeta de un libro del catálogo. */
export function BookCard({ book }: Readonly<{ book: Book }>) {
  const titleId = useId()
  const soldOut = book.availableCopies === 0

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {book.title}
        </h2>
        <AvailabilityBadge availableCopies={book.availableCopies} />
      </header>
      <p className={styles.author}>{book.author}</p>
      <p className={styles.isbn}>ISBN {formatIsbn(book.isbn)}</p>
      <div className={styles.actions}>
        {soldOut ? (
          <button type="button" disabled>
            Pedir prestado <span className="visually-hidden">{book.title}</span>
          </button>
        ) : (
          <Link className="button" href={`/libros/${book.id}`}>
            Pedir prestado <span className="visually-hidden">{book.title}</span>
          </Link>
        )}
      </div>
    </article>
  )
}
