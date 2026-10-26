import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { BOOK_IDS } from '@/mocks/fixtures'
import { server } from '@/mocks/node'
import { BorrowForm } from './BorrowForm'

/** server.use() reemplaza el handler solo en este test: así forzamos cada 409 del contrato. */
function respondWithConflict(code: string) {
  server.use(
    http.post('*/api/loans', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Conflict', status: 409, code, detail: code },
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  )
}

async function borrow(email = 'ana@uc.cl') {
  const user = userEvent.setup()
  render(<BorrowForm bookId={BOOK_IDS.cienAnos} />)
  await user.type(screen.getByLabelText('Correo'), email)
  await user.click(screen.getByRole('button', { name: 'Pedir prestado' }))
}

describe('BorrowForm', () => {
  it('[UI-LOAN-1] confirma el préstamo y muestra la fecha de devolución dd-mm-aaaa', async () => {
    // El mock server usa la fecha fija de prueba 2026-03-02T12:00:00Z, más 14 días (LOAN-R3).
    await borrow()
    const status = await screen.findByRole('status')
    expect(await screen.findByText('Préstamo registrado')).toBeInTheDocument()
    expect(status).toHaveTextContent('Fecha de devolución: 16-03-2026')
  })

  it('[UI-LOAN-4] LOAN_LIMIT_REACHED muestra "Alcanzaste el máximo de 3 préstamos activos"', async () => {
    respondWithConflict('LOAN_LIMIT_REACHED')
    await borrow()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alcanzaste el máximo de 3 préstamos activos',
    )
  })

  it('[UI-LOAN-4] NO_COPIES_AVAILABLE muestra "No quedan copias disponibles"', async () => {
    respondWithConflict('NO_COPIES_AVAILABLE')
    await borrow()
    expect(await screen.findByRole('alert')).toHaveTextContent('No quedan copias disponibles')
  })

  it('[UI-LOAN-4] DUPLICATE_LOAN muestra "Ya tienes este libro prestado"', async () => {
    respondWithConflict('DUPLICATE_LOAN')
    await borrow()
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tienes este libro prestado')
  })
})
