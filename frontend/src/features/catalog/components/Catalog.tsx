'use client'

import { useState, type SubmitEvent } from 'react'
import { BookList } from './BookList'
import styles from './Catalog.module.css'

/** Buscador más grilla. La búsqueda se envía al presionar "Buscar" (BOOK-R5 la resuelve la API). */
export function Catalog() {
  const [query, setQuery] = useState('')

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setQuery(String(data.get('q') ?? ''))
  }

  return (
    <div className={styles.catalog}>
      <form
        role="search"
        aria-label="Buscar libros"
        className={styles.search}
        onSubmit={handleSubmit}
      >
        <div className={styles.field}>
          <label htmlFor="catalog-q">Buscar por título o autor</label>
          <input id="catalog-q" name="q" type="search" maxLength={100} autoComplete="off" />
        </div>
        <button type="submit">Buscar</button>
      </form>
      <BookList query={query} />
    </div>
  )
}
