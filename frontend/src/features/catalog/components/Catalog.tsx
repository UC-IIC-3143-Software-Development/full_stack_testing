'use client'

import { useState, type SubmitEvent } from 'react'
import { BookList } from './BookList'
import styles from './Catalog.module.css'

/**
 * Buscador más grilla. La búsqueda se envía al presionar "Buscar" (BOOK-R5 la resuelve la API).
 * La casilla "Solo disponibles" filtra en el navegador sin pedir nada nuevo a la API (UI-CAT-7).
 */
export function Catalog() {
  const [query, setQuery] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)

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
        <div className={styles.toggle}>
          <input
            id="catalog-only-available"
            type="checkbox"
            checked={onlyAvailable}
            onChange={(event) => setOnlyAvailable(event.currentTarget.checked)}
          />
          <label htmlFor="catalog-only-available">Solo disponibles</label>
        </div>
      </form>
      <BookList query={query} onlyAvailable={onlyAvailable} />
    </div>
  )
}
