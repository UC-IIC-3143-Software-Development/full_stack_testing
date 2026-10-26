'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { Loan } from '@/shared/api/types'
import { formatDate } from '@/shared/domain/date-format'
import { GENERIC_ERROR_MESSAGE, loanActionMessage } from './loan-error-messages'
import { useLoans, type LoanActionSuccess } from '../hooks/useLoans'
import { LoanStatusLabel } from './LoanStatusLabel'
import styles from './LoanList.module.css'

/** UI-RENEW-1: solo un préstamo activo que todavía no se renovó ofrece "Renovar". */
function canRenew(loan: Loan) {
  return loan.status === 'ACTIVE' && loan.renewalCount === 0
}

/** Texto de la región de estado (UI-LOAN-3 y UI-RENEW-1). */
function successMessage(success: LoanActionSuccess | null): string {
  if (!success) return ''
  return success.action === 'renew'
    ? `Préstamo renovado hasta ${formatDate(success.loan.dueAt)}`
    : 'Préstamo devuelto'
}

/** Callback ref que guarda el nodo de cada préstamo en un mapa (para mover el foco). */
function refIn<T extends HTMLElement>(nodes: RefObject<Map<string, T>>, loanId: string) {
  return (node: T | null) => {
    if (node) nodes.current.set(loanId, node)
    else nodes.current.delete(loanId)
  }
}

/**
 * UI-LOAN-2: préstamos de un correo con su etiqueta de estado.
 * UI-LOAN-3: "Devolver" actualiza la etiqueta a "Devuelto" sin recargar la página.
 * UI-RENEW-1 y UI-RENEW-2: "Renovar" extiende la fecha sin recargar o muestra el error.
 */
export function LoanList({ email }: { email: string }) {
  const { state, loans, returnLoan, renewLoan, pending, actionFailure, lastSuccess } =
    useLoans(email)
  const returnButtons = useRef(new Map<string, HTMLButtonElement>())
  const titles = useRef(new Map<string, HTMLHeadingElement>())

  // El botón que se usó se desmonta (WCAG 2.4.3): tras renovar, el foco va a "Devolver" del
  // mismo préstamo y tras devolver, al título del préstamo.
  useEffect(() => {
    if (!lastSuccess) return
    const { loan, action } = lastSuccess
    const target =
      action === 'renew' ? returnButtons.current.get(loan.id) : titles.current.get(loan.id)
    target?.focus()
  }, [lastSuccess])

  if (state.status === 'loading' || state.status === 'idle') {
    return <p aria-live="polite">Cargando préstamos...</p>
  }
  if (state.status === 'error') {
    const detail = state.failure.kind === 'problem' ? state.failure.problem.detail : undefined
    return (
      <p role="alert" className="alert">
        {detail ?? GENERIC_ERROR_MESSAGE}
      </p>
    )
  }
  if (loans.length === 0) {
    return <p>No hay préstamos registrados para {email}.</p>
  }

  return (
    <section className={styles.section} aria-labelledby="loans-heading">
      <h2 id="loans-heading" className={styles.heading}>
        Préstamos de {email}
      </h2>
      <ul className={styles.list}>
        {loans.map((loan) => (
          <li key={loan.id} className={styles.item}>
            <div className={styles.header}>
              <h3 ref={refIn(titles, loan.id)} tabIndex={-1} className={styles.title}>
                {loan.bookTitle}
              </h3>
              <LoanStatusLabel status={loan.status} />
            </div>
            <dl className={styles.dates}>
              <div>
                <dt>Préstamo</dt>
                <dd>{formatDate(loan.loanedAt)}</dd>
              </div>
              <div>
                <dt>{loan.returnedAt ? 'Devuelto el' : 'Devolver hasta'}</dt>
                <dd>{formatDate(loan.returnedAt ?? loan.dueAt)}</dd>
              </div>
            </dl>
            {loan.status !== 'RETURNED' && (
              <div className={styles.actions}>
                <button
                  ref={refIn(returnButtons, loan.id)}
                  type="button"
                  className={styles.secondaryButton}
                  disabled={pending === loan.id}
                  onClick={() => returnLoan(loan.id)}
                >
                  Devolver <span className="visually-hidden">{loan.bookTitle}</span>
                </button>
                {canRenew(loan) && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={pending === loan.id}
                    onClick={() => renewLoan(loan.id)}
                  >
                    Renovar <span className="visually-hidden">{loan.bookTitle}</span>
                  </button>
                )}
              </div>
            )}
            {actionFailure?.loanId === loan.id && (
              <p role="alert" className="alert">
                {loanActionMessage(actionFailure.failure, actionFailure.action)}
              </p>
            )}
          </li>
        ))}
      </ul>
      {/* Siempre montada, así el lector de pantalla anuncia cada cambio de texto (WCAG 4.1.3). */}
      <p role="status" className="visually-hidden">
        {successMessage(lastSuccess)}
      </p>
    </section>
  )
}
