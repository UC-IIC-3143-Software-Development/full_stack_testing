'use client'

import { useState, type SubmitEvent } from 'react'
import { LoanList } from './LoanList'
import styles from './LoansLookup.module.css'

/** "Mis préstamos": busca por correo (UI-LOAN-2). */
export function LoansLookup() {
  const [email, setEmail] = useState<string | null>(null)

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    setEmail(value || null)
  }

  return (
    <div className={styles.lookup}>
      <form className={styles.form} onSubmit={handleSubmit} aria-label="Buscar préstamos">
        <div className={styles.field}>
          <label htmlFor="loans-email">Correo</label>
          <input id="loans-email" name="email" type="email" autoComplete="email" required />
        </div>
        <button type="submit">Buscar préstamos</button>
      </form>
      {email ? (
        <LoanList key={email} email={email} />
      ) : (
        <p className={styles.hint}>Ingresa tu correo para ver tus préstamos.</p>
      )}
    </div>
  )
}
