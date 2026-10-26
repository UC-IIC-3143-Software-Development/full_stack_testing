'use client'

import { useBooks } from '../hooks/useBooks'
import { BookCard } from './BookCard'
import styles from './BookList.module.css'

interface BookListProps {
  query: string
  /** UI-CAT-7: oculta en el navegador los libros sin copias disponibles. */
  onlyAvailable?: boolean
}

/** Grilla del catálogo (UI-CAT-1 y UI-CAT-4). Los datos vienen del hook, nunca de fetch directo (ARCH-R7). */
export function BookList({ query, onlyAvailable = false }: Readonly<BookListProps>) {
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

  const books = onlyAvailable ? state.data.filter((book) => book.availableCopies > 0) : state.data
  if (books.length === 0) {
    return (
      <p>
        No hay libros disponibles para tu búsqueda. Desmarca “Solo disponibles” para ver los
        agotados.
      </p>
    )
  }

  return (
    <ul className={styles.grid} aria-label="Libros del catálogo">
      {books.map((book) => (
        <li key={book.id} className={styles.item}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  )
}
