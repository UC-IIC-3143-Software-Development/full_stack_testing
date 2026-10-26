import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Book } from '@/shared/api/types'
import { BookCard } from './BookCard'

// Componente presentacional: se prueba con datos literales, sin red.
// Los colores (UI-CAT-2) no se pueden medir en jsdom: los verifica tests/style con Playwright.
function aBook(availableCopies: number): Book {
  return {
    id: '6f1c2a9e-8b7d-4c6e-9f10-000000000099',
    isbn: '9788437604947',
    title: 'Rayuela',
    author: 'Julio Cortázar',
    totalCopies: 2,
    availableCopies,
    createdAt: '2026-03-02T12:00:00.000Z',
  }
}

describe('BookCard', () => {
  it('[UI-CAT-1] muestra título, autor e ISBN con guiones', () => {
    render(<BookCard book={aBook(2)} />)
    const card = screen.getByRole('article', { name: 'Rayuela' })
    expect(within(card).getByText('Julio Cortázar')).toBeInTheDocument()
    expect(within(card).getByText('ISBN 978-84-376-0494-7')).toBeInTheDocument()
  })

  it('[UI-CAT-2] con 1 copia muestra "Disponible (1)" (valor límite)', () => {
    render(<BookCard book={aBook(1)} />)
    expect(screen.getByText('Disponible (1)')).toBeInTheDocument()
  })

  it('[UI-CAT-2] con 0 copias muestra "Agotado" (valor límite)', () => {
    render(<BookCard book={aBook(0)} />)
    expect(screen.getByText('Agotado')).toBeInTheDocument()
  })

  it('[UI-CAT-3] "Pedir prestado" lleva al detalle cuando hay copias', () => {
    render(<BookCard book={aBook(1)} />)
    expect(screen.getByRole('link', { name: /pedir prestado/i })).toHaveAttribute(
      'href',
      '/libros/6f1c2a9e-8b7d-4c6e-9f10-000000000099',
    )
  })

  it('[UI-CAT-3] "Pedir prestado" está deshabilitado cuando está agotado', () => {
    render(<BookCard book={aBook(0)} />)
    expect(screen.getByRole('button', { name: /pedir prestado/i })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /pedir prestado/i })).not.toBeInTheDocument()
  })
})
