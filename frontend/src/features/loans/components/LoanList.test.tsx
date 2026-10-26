import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LoanList } from './LoanList'

// carla@uc.cl tiene en el mock server un préstamo de cada estado (src/mocks/fixtures.ts),
// evaluado con el reloj fijo 2026-03-02T12:00:00Z.
function loanItem(title: string) {
  return screen
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('heading', { name: title }))!
}

describe('LoanList', () => {
  it('[UI-LOAN-2] lista los préstamos del correo con su etiqueta de estado', async () => {
    render(<LoanList email="carla@uc.cl" />)
    await screen.findByRole('heading', { name: 'Préstamos de carla@uc.cl' })

    const rows = screen.getAllByRole('listitem').map((item) => ({
      title: within(item).getByRole('heading').textContent,
      status: within(item).getByText(/^(Activo|Vencido|Devuelto)$/).textContent,
    }))
    expect(rows).toEqual([
      { title: 'La casa de los espíritus', status: 'Activo' },
      { title: 'Ficciones', status: 'Vencido' },
      { title: 'Pedro Páramo', status: 'Devuelto' },
    ])
  })

  it('[UI-LOAN-3] "Devolver" cambia la etiqueta a "Devuelto" sin recargar', async () => {
    const user = userEvent.setup()
    render(<LoanList email="carla@uc.cl" />)
    await screen.findByRole('heading', { name: 'Préstamos de carla@uc.cl' })

    await user.click(within(loanItem('Ficciones')).getByRole('button', { name: /devolver/i }))

    expect(await within(loanItem('Ficciones')).findByText('Devuelto')).toBeInTheDocument()
    expect(within(loanItem('Ficciones')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(loanItem('Ficciones')).getByText('Devuelto el')).toBeInTheDocument()
  })

  it('[UI-LOAN-3] solo los préstamos no devueltos ofrecen "Devolver"', async () => {
    render(<LoanList email="carla@uc.cl" />)
    await screen.findByRole('heading', { name: 'Préstamos de carla@uc.cl' })
    expect(within(loanItem('Pedro Páramo')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(loanItem('La casa de los espíritus')).getByRole('button')).toBeEnabled()
  })
})
