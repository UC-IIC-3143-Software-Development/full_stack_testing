'use client'

import { BookDetail } from '@/features/catalog/components/BookDetail'
import { useBook } from '@/features/catalog/hooks/useBook'
import { BorrowForm } from '@/features/loans/components/BorrowForm'

/** Composición de dos features: ficha del libro (catálogo) y formulario de préstamo. */
export function BookScreen({ bookId }: { bookId: string }) {
  const { state, reload } = useBook(bookId)

  if (state.status === 'loading' || state.status === 'idle') {
    return <p aria-live="polite">Cargando libro...</p>
  }
  if (state.status === 'error') {
    // 404 (no existe) y 400 (id que no es UUID) significan lo mismo para quien navega (BOOK-R6).
    const notFound =
      state.failure.kind === 'problem' && [400, 404].includes(state.failure.problem.status)
    return (
      <p role="alert" className="alert">
        {notFound ? 'No encontramos este libro.' : 'No pudimos cargar el libro.'}
      </p>
    )
  }

  const book = state.data
  return (
    <>
      <BookDetail book={book} />
      <section aria-labelledby="borrow-heading" className="stack">
        <h2 id="borrow-heading">Pedir prestado</h2>
        <BorrowForm bookId={book.id} disabled={book.availableCopies === 0} onBorrowed={reload} />
      </section>
    </>
  )
}
