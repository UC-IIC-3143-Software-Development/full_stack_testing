'use client'

import type { Loan } from '@/shared/api/types'
import { formatDate } from '@/shared/domain/date-format'
import { GENERIC_ERROR_MESSAGE, loanActionMessage } from './loan-error-messages'
import { useLoans } from '../hooks/useLoans'
import { LoanStatusLabel } from './LoanStatusLabel'
import styles from './LoanList.module.css'

/** UI-RENEW-1: solo un préstamo activo que todavía no se renovó ofrece "Renovar". */
function canRenew(loan: Loan) {
  return loan.status === 'ACTIVE' && loan.renewalCount === 0
}

/**
 * UI-LOAN-2: préstamos de un correo con su etiqueta de estado.
 * UI-LOAN-3: "Devolver" actualiza la etiqueta a "Devuelto" sin recargar la página.
 * UI-RENEW-1 y UI-RENEW-2: "Renovar" extiende la fecha sin recargar o muestra el error.
 */
export function LoanList({ email }: { email: string }) {
  const { state, loans, returnLoan, renewLoan, pending, actionFailure } = useLoans(email)

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
              <h3 className={styles.title}>{loan.bookTitle}</h3>
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
    </section>
  )
}
