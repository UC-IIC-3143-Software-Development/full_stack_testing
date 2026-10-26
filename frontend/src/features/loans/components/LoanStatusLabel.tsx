import type { CSSProperties } from 'react'
import { presentLoanStatus, type LoanStatus } from '@/shared/domain/loan-status'
import styles from './LoanStatusLabel.module.css'

/** UI-LOAN-2: etiqueta de estado. El color sale del token que define shared/domain. */
export function LoanStatusLabel({ status }: Readonly<{ status: LoanStatus }>) {
  const { label, colorToken } = presentLoanStatus(status)
  const style = { '--status-color': `var(${colorToken})` } as CSSProperties
  return (
    <span className={styles.label} style={style}>
      {label}
    </span>
  )
}
