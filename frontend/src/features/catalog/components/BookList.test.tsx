import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/node'
import { BookList } from './BookList'

// Sin vi.mock: el componente hace solicitudes HTTP reales que responde el mock server (MSW)
// con los datos de specs/flows/README.md.
describe('BookList', () => {
  it('[UI-CAT-1] muestra una tarjeta por libro del catálogo, ordenadas por título', async () => {
    render(<BookList query="" />)
    const list = await screen.findByRole('list', { name: 'Libros del catálogo' })
    const titles = within(list)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(titles).toEqual([
      'Cien años de soledad',
      'Desolación',
      'Ficciones',
      'La casa de los espíritus',
      'Pedro Páramo',
      'Veinte poemas de amor y una canción desesperada',
    ])
  })

  it('[UI-CAT-1] muestra solo las tarjetas que devuelve la búsqueda', async () => {
    render(<BookList query="garcia marquez" />)
    const card = await screen.findByRole('article', { name: 'Cien años de soledad' })
    expect(within(card).getByText('Disponible (3)')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('[UI-CAT-1] avisa cuando no puede cargar el catálogo', async () => {
    // Override puntual del handler: simula una caída de red solo en este test.
    server.use(http.get('*/api/books', () => HttpResponse.error()))
    render(<BookList query="" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el catálogo')
  })
})
