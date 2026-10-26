import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished } from 'vitest'
import { server } from '@/mocks/node'
import { Catalog } from './Catalog'

// Sin vi.mock ni vi.fn: el catálogo pide los libros al mock server (MSW) con los datos de
// specs/flows/README.md. La casilla filtra en el navegador, así que no debe pedir nada nuevo.
async function visibleTitles() {
  const list = await screen.findByRole('list', { name: 'Libros del catálogo' })
  return within(list)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)
}

describe('Catalog', () => {
  it('[UI-CAT-7] "Solo disponibles" oculta los agotados y deja los que tienen 1 copia o más', async () => {
    const requests: string[] = []
    render(<Catalog />)
    expect(await visibleTitles()).toHaveLength(6)
    server.events.on('request:start', ({ request }) => requests.push(request.url))
    onTestFinished(() => server.events.removeAllListeners())

    const checkbox = screen.getByRole('checkbox', { name: 'Solo disponibles' })
    expect(checkbox).not.toBeChecked()
    await userEvent.setup().click(checkbox)

    // Desolación y Ficciones tienen 1 copia disponible (valor límite): se siguen viendo.
    expect(await visibleTitles()).toEqual([
      'Cien años de soledad',
      'Desolación',
      'Ficciones',
      'Pedro Páramo',
      'Veinte poemas de amor y una canción desesperada',
    ])
    expect(requests).toEqual([])
  })

  it('[UI-CAT-7] se combina con la búsqueda y avisa si ningún resultado está disponible', async () => {
    const user = userEvent.setup()
    render(<Catalog />)
    await user.click(screen.getByRole('checkbox', { name: 'Solo disponibles' }))
    await user.type(screen.getByLabelText('Buscar por título o autor'), 'allende')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(
      await screen.findByText(
        'No hay libros disponibles para tu búsqueda. Desmarca “Solo disponibles” para ver los agotados.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Solo disponibles' }))
    expect(await visibleTitles()).toEqual(['La casa de los espíritus'])
  })
})
