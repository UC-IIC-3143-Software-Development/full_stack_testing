import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished } from 'vitest'
import { server } from '@/mocks/node'
import type { Book } from '@/shared/api/types'
import { NewBookForm } from './NewBookForm'

interface FormValues {
  isbn: string
  title: string
  author?: string
  copies?: string
}

async function fillForm(values: FormValues) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('ISBN'), values.isbn)
  await user.type(screen.getByLabelText('Título'), values.title)
  await user.type(screen.getByLabelText('Autor'), values.author ?? 'Julio Cortázar')
  await user.clear(screen.getByLabelText('Copias'))
  await user.type(screen.getByLabelText('Copias'), values.copies ?? '2')
  await user.click(screen.getByRole('button', { name: 'Guardar libro' }))
}

describe('NewBookForm', () => {
  it('[UI-CAT-5] valida el ISBN en el navegador y no envía la solicitud', async () => {
    // Escuchamos la red real del mock server en vez de espiar funciones (sin vi.fn).
    const requests: string[] = []
    server.events.on('request:start', ({ request }) => requests.push(request.url))
    onTestFinished(() => server.events.removeAllListeners())
    render(<NewBookForm onCreated={() => {}} />)

    await fillForm({ isbn: '978-0-00-000000-1', title: 'Libro falso' })

    expect(screen.getByLabelText('ISBN')).toHaveAccessibleDescription('El ISBN no es válido')
    expect(screen.getByLabelText('ISBN')).toHaveFocus()
    expect(requests).toEqual([])
  })

  it('[UI-CAT-5] muestra el 409 del servidor junto al campo ISBN', async () => {
    // El ISBN ya existe en la "base de datos" del mock server (Cien años de soledad).
    render(<NewBookForm onCreated={() => {}} />)
    await fillForm({ isbn: '978-0-307-47472-8', title: 'Otra edición' })
    await waitFor(() =>
      expect(screen.getByLabelText('ISBN')).toHaveAccessibleDescription(
        'Ya existe un libro con ese ISBN',
      ),
    )
  })

  it('[UI-CAT-5] muestra los errores 400 del servidor junto a cada campo', async () => {
    // El navegador solo valida el ISBN. El autor en blanco lo rechaza el servidor (BOOK-R3)
    // con el mismo texto que el backend (backend/src/books/domain/book.ts).
    render(<NewBookForm onCreated={() => {}} />)
    await fillForm({ isbn: '978-84-376-0494-7', title: 'Rayuela', author: ' ' })
    await waitFor(() =>
      expect(screen.getByLabelText('Autor')).toHaveAccessibleDescription(
        'El autor no puede estar vacío',
      ),
    )
  })

  it('[UI-CAT-5] envía un libro válido y entrega el libro creado', async () => {
    let created: Book | undefined
    render(<NewBookForm onCreated={(book) => (created = book)} />)
    await fillForm({ isbn: '978-84-376-0494-7', title: 'Rayuela' })
    await waitFor(() => expect(created?.isbn).toBe('9788437604947'))
    expect(created).toMatchObject({ title: 'Rayuela', totalCopies: 2, availableCopies: 2 })
  })
})
