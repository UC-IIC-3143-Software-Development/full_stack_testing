'use client'

import { useState, type InputHTMLAttributes, type SubmitEvent } from 'react'
import type { ApiFailure } from '@/shared/api/problem'
import type { Book } from '@/shared/api/types'
import { isValidIsbn13 } from '@/shared/domain/isbn'
import { useCreateBook } from '../hooks/useCreateBook'
import styles from './NewBookForm.module.css'

type Field = 'isbn' | 'title' | 'author' | 'totalCopies'

const FIELDS: {
  name: Field
  label: string
  type: string
  extra?: InputHTMLAttributes<HTMLInputElement>
}[] = [
  {
    name: 'isbn',
    label: 'ISBN',
    type: 'text',
    extra: { placeholder: '978-84-376-0494-7', autoComplete: 'off' },
  },
  { name: 'title', label: 'Título', type: 'text', extra: { maxLength: 200 } },
  { name: 'author', label: 'Autor', type: 'text', extra: { maxLength: 120 } },
  {
    name: 'totalCopies',
    label: 'Copias',
    type: 'number',
    extra: { min: 1, max: 50, defaultValue: 1 },
  },
]

interface FormErrors {
  fields: Record<string, string>
  general?: string
}

function serverErrors(failure: ApiFailure, fields: Record<string, string>): FormErrors {
  if (failure.kind === 'problem' && failure.problem.code === 'ISBN_ALREADY_EXISTS') {
    return { fields: { isbn: 'Ya existe un libro con ese ISBN' } }
  }
  if (Object.keys(fields).length > 0) return { fields }
  return { fields: {}, general: 'No pudimos guardar el libro. Intenta de nuevo.' }
}

/**
 * UI-CAT-5: valida el ISBN en el navegador antes de enviar (BOOK-R1) y muestra los
 * errores del servidor junto al campo correspondiente. Quien lo usa decide qué hacer
 * después de crear el libro (onCreated), así el componente no depende del router.
 */
export function NewBookForm({ onCreated }: Readonly<{ onCreated: (book: Book) => void }>) {
  const { createBook, pending } = useCreateBook()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const isbn = String(data.get('isbn') ?? '')
    setGeneralError(null)

    if (!isValidIsbn13(isbn)) {
      setErrors({ isbn: 'El ISBN no es válido' })
      form.querySelector<HTMLInputElement>('[name="isbn"]')?.focus()
      return
    }

    const result = await createBook({
      isbn,
      title: String(data.get('title') ?? ''),
      author: String(data.get('author') ?? ''),
      totalCopies: Number(data.get('totalCopies')),
    })
    if (result.ok) {
      setErrors({})
      onCreated(result.book)
      return
    }
    const { fields, general } = serverErrors(result.failure, result.fieldErrors)
    setErrors(fields)
    setGeneralError(general ?? null)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="Agregar libro">
      {generalError && (
        <p role="alert" className="alert">
          {generalError}
        </p>
      )}
      {FIELDS.map(({ name, label, type, extra }) => {
        const error = errors[name]
        const errorId = `${name}-error`
        return (
          <div key={name} className={styles.field}>
            <label htmlFor={`book-${name}`}>{label}</label>
            <input
              id={`book-${name}`}
              name={name}
              type={type}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              {...extra}
            />
            {error && (
              <p id={errorId} className="field-error">
                {error}
              </p>
            )}
          </div>
        )
      })}
      <div>
        <button type="submit" disabled={pending}>
          {pending ? 'Guardando...' : 'Guardar libro'}
        </button>
      </div>
    </form>
  )
}
