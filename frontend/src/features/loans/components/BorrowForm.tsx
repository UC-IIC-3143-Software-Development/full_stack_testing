'use client'

import { useState, type SubmitEvent } from 'react'
import type { Loan } from '@/shared/api/types'
import { formatDate } from '@/shared/domain/date-format'
import { GENERIC_ERROR_MESSAGE, loanConflictMessage } from './loan-error-messages'
import { useCreateLoan } from '../hooks/useCreateLoan'
import styles from './BorrowForm.module.css'

interface BorrowFormProps {
  bookId: string
  disabled?: boolean
  onBorrowed?: (loan: Loan) => void
}

/**
 * UI-LOAN-1: pide el correo y, al confirmar, muestra "Préstamo registrado" y la
 * fecha de devolución dd-mm-aaaa. UI-LOAN-4: traduce los 409 a mensajes en español.
 */
export function BorrowForm({ bookId, disabled = false, onBorrowed }: Readonly<BorrowFormProps>) {
  const { createLoan, pending } = useCreateLoan()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    setError(null)
    setEmailError(null)
    setLoan(null)

    const result = await createLoan(bookId, email)
    if (result.ok) {
      setLoan(result.loan)
      onBorrowed?.(result.loan)
      return
    }
    const { failure, fieldErrors } = result
    if (failure.kind === 'problem' && failure.problem.status === 409) {
      setError(loanConflictMessage(failure.problem.code))
    } else if (fieldErrors.borrowerEmail) {
      setEmailError(fieldErrors.borrowerEmail)
    } else if (failure.kind === 'problem' && failure.problem.detail) {
      setError(failure.problem.detail)
    } else {
      setError(GENERIC_ERROR_MESSAGE)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="Pedir prestado">
      <div>
        <label htmlFor="borrow-email">Correo</label>
        <input
          id="borrow-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'borrow-email-error' : undefined}
        />
        {emailError && (
          <p id="borrow-email-error" className="field-error">
            {emailError}
          </p>
        )}
      </div>
      <div>
        <button type="submit" disabled={disabled || pending}>
          Pedir prestado
        </button>
      </div>
      {/* La región viva existe desde el inicio para que el lector de pantalla anuncie el cambio. */}
      <div role="status" className={loan ? 'notice' : undefined}>
        {loan && (
          <>
            <p className={styles.success}>Préstamo registrado</p>
            <p className={styles.due}>Fecha de devolución: {formatDate(loan.dueAt)}</p>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
    </form>
  )
}
