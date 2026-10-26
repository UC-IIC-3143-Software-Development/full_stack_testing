'use client'

import { useBooks } from '../hooks/useBooks'
import { BookCard } from './BookCard'
import styles from './BookList.module.css'

/** Grilla del catálogo (UI-CAT-1 y UI-CAT-4). Los datos vienen del hook, nunca de fetch directo (ARCH-R7). */
export function BookList({ query }: Readonly<{ query: string }>) {
  const { state } = useBooks(query)

  if (state.status === 'loading' || state.status === 'idle') {
    return <p aria-live="polite">Cargando libros...</p>
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="alert">
        No pudimos cargar el catálogo. Intenta de nuevo en unos minutos.
      </p>
    )
  }
  if (state.data.length === 0) {
    return <p>No encontramos libros para tu búsqueda.</p>
  }

  return (
    <ul className={styles.grid} aria-label="Libros del catálogo">
      {state.data.map((book) => (
        <li key={book.id} className={styles.item}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  )
}
