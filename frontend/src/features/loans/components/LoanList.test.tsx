import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { BOOK_IDS, type StoredLoan } from '@/mocks/fixtures'
import { mockStore, server } from '@/mocks/node'
import type { RenewalErrorCode } from '@/shared/api/types'
import { LoanList } from './LoanList'

// carla@uc.cl tiene en el mock server un préstamo de cada estado (src/mocks/fixtures.ts),
// evaluado con la fecha fija de prueba 2026-03-02T12:00:00Z.
function loanItem(title: string) {
  return screen
    .getAllByRole('listitem')
    .find((item) => within(item).queryByRole('heading', { name: title }))!
}

/** Fecha que acompaña al término "Devolver hasta" en la lista de fechas del préstamo. */
function dueDate(title: string) {
  const pair = within(loanItem(title)).getByText('Devolver hasta').parentElement!
  return within(pair).getByRole('definition').textContent
}

async function showCarlaLoans() {
  render(<LoanList email="carla@uc.cl" />)
  await screen.findByRole('heading', { name: 'Préstamos de carla@uc.cl' })
}

/** server.use() reemplaza el handler solo en este test: así forzamos cada 409 de renewLoan. */
function respondToRenewWithConflict(code: RenewalErrorCode, detail: string = code) {
  server.use(
    http.post('*/api/loans/:loanId/renew', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Conflict', status: 409, code, detail },
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  )
}

/** Un préstamo activo de carla@uc.cl que ya se renovó: 14 días más 7 de la renovación. */
const RENEWED_LOAN: StoredLoan = {
  id: '0a7d3b52-1c4e-4f8a-9b6d-000000000104',
  bookId: BOOK_IDS.cienAnos,
  bookTitle: 'Cien años de soledad',
  borrowerEmail: 'carla@uc.cl',
  loanedAt: '2026-02-25T12:00:00.000Z',
  dueAt: '2026-03-18T12:00:00.000Z',
  returnedAt: null,
  renewalCount: 1,
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

  it('[UI-LOAN-3] al devolver anuncia "Préstamo devuelto" y el foco pasa al título del préstamo', async () => {
    const user = userEvent.setup()
    await showCarlaLoans()

    await user.click(within(loanItem('Ficciones')).getByRole('button', { name: /devolver/i }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Préstamo devuelto'))
    expect(within(loanItem('Ficciones')).getByRole('heading', { name: 'Ficciones' })).toHaveFocus()
  })

  it('[UI-LOAN-3] solo los préstamos no devueltos ofrecen "Devolver"', async () => {
    render(<LoanList email="carla@uc.cl" />)
    await screen.findByRole('heading', { name: 'Préstamos de carla@uc.cl' })
    expect(within(loanItem('Pedro Páramo')).queryByRole('button')).not.toBeInTheDocument()
    expect(
      within(loanItem('La casa de los espíritus')).getByRole('button', { name: /devolver/i }),
    ).toBeEnabled()
  })

  it('[UI-RENEW-1] solo los préstamos activos sin renovar ofrecen "Renovar"', async () => {
    const state = mockStore.read()
    mockStore.write({ ...state, loans: [...state.loans, RENEWED_LOAN] })
    await showCarlaLoans()

    const rows = screen.getAllByRole('listitem').map((item) => ({
      title: within(item).getByRole('heading').textContent,
      status: within(item).getByText(/^(Activo|Vencido|Devuelto)$/).textContent,
      renew: within(item).queryByRole('button', { name: /renovar/i }) !== null,
    }))
    expect(rows).toEqual([
      { title: 'Cien años de soledad', status: 'Activo', renew: false },
      { title: 'La casa de los espíritus', status: 'Activo', renew: true },
      { title: 'Ficciones', status: 'Vencido', renew: false },
      { title: 'Pedro Páramo', status: 'Devuelto', renew: false },
    ])
  })

  it('[UI-RENEW-1] "Renovar" actualiza la fecha de devolución sin recargar y el botón desaparece', async () => {
    const user = userEvent.setup()
    await showCarlaLoans()
    expect(dueDate('La casa de los espíritus')).toBe('06-03-2026')

    await user.click(
      within(loanItem('La casa de los espíritus')).getByRole('button', { name: /renovar/i }),
    )

    await waitFor(() => expect(dueDate('La casa de los espíritus')).toBe('13-03-2026'))
    const item = within(loanItem('La casa de los espíritus'))
    expect(item.queryByRole('button', { name: /renovar/i })).not.toBeInTheDocument()
    expect(item.getByRole('button', { name: /devolver/i })).toBeEnabled()
  })

  it('[UI-RENEW-1] al renovar anuncia la nueva fecha y el foco pasa a "Devolver" del mismo préstamo', async () => {
    const user = userEvent.setup()
    await showCarlaLoans()

    await user.click(
      within(loanItem('La casa de los espíritus')).getByRole('button', { name: /renovar/i }),
    )

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Préstamo renovado hasta 13-03-2026'),
    )
    expect(
      within(loanItem('La casa de los espíritus')).getByRole('button', { name: /devolver/i }),
    ).toHaveFocus()
  })

  it('[UI-RENEW-2] RENEWAL_LIMIT_REACHED muestra "Este préstamo ya fue renovado"', async () => {
    respondToRenewWithConflict('RENEWAL_LIMIT_REACHED')
    const user = userEvent.setup()
    await showCarlaLoans()

    await user.click(
      within(loanItem('La casa de los espíritus')).getByRole('button', { name: /renovar/i }),
    )

    expect(
      await within(loanItem('La casa de los espíritus')).findByRole('alert'),
    ).toHaveTextContent('Este préstamo ya fue renovado')
  })

  it('[UI-RENEW-2] LOAN_OVERDUE muestra "No puedes renovar un préstamo vencido"', async () => {
    respondToRenewWithConflict('LOAN_OVERDUE')
    const user = userEvent.setup()
    await showCarlaLoans()

    await user.click(
      within(loanItem('La casa de los espíritus')).getByRole('button', { name: /renovar/i }),
    )

    expect(
      await within(loanItem('La casa de los espíritus')).findByRole('alert'),
    ).toHaveTextContent('No puedes renovar un préstamo vencido')
  })

  it('[UI-RENEW-2] ALREADY_RETURNED muestra el detail de la API', async () => {
    respondToRenewWithConflict('ALREADY_RETURNED', 'El préstamo ya fue devuelto')
    const user = userEvent.setup()
    await showCarlaLoans()

    await user.click(
      within(loanItem('La casa de los espíritus')).getByRole('button', { name: /renovar/i }),
    )

    expect(
      await within(loanItem('La casa de los espíritus')).findByRole('alert'),
    ).toHaveTextContent('El préstamo ya fue devuelto')
  })
})
