import { useState } from 'react'
import { apiClient } from '@/shared/api/client'
import { toApiFailure, type ApiFailure } from '@/shared/api/problem'
import type { Loan } from '@/shared/api/types'
import { useApiQuery } from '@/shared/api/use-api-query'

export type LoanAction = 'return' | 'renew'

/** Última devolución o renovación exitosa: la UI la anuncia y mueve el foco (UI-LOAN-3, UI-RENEW-1). */
export interface LoanActionSuccess {
  loan: Loan
  action: LoanAction
}

export interface LoanActionFailure {
  loanId: string
  action: LoanAction
  failure: ApiFailure
}

/** Lo que devuelve openapi-fetch para returnLoan y renewLoan. */
interface LoanResponse {
  data?: Loan
  error?: unknown
}

/**
 * Préstamos de un correo (listLoans), devolución (returnLoan) y renovación (renewLoan).
 * UI-LOAN-3 y UI-RENEW-1: la respuesta reemplaza el préstamo en memoria, sin recargar la página.
 */
export function useLoans(borrowerEmail: string) {
  const { state } = useApiQuery<Loan[]>(`loans:${borrowerEmail}`, () =>
    apiClient.GET('/api/loans', { params: { query: { borrowerEmail } } }),
  )
  const [updated, setUpdated] = useState<Record<string, Loan>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [actionFailure, setActionFailure] = useState<LoanActionFailure | null>(null)
  const [lastSuccess, setLastSuccess] = useState<LoanActionSuccess | null>(null)

  async function run(loanId: string, action: LoanAction, request: () => Promise<LoanResponse>) {
    setPending(loanId)
    setActionFailure(null)
    setLastSuccess(null)
    try {
      const { data, error } = await request()
      if (data) {
        setUpdated((prev) => ({ ...prev, [loanId]: data }))
        setLastSuccess({ loan: data, action })
      } else setActionFailure({ loanId, action, failure: toApiFailure(error) })
    } catch (error) {
      setActionFailure({ loanId, action, failure: toApiFailure(error) })
    } finally {
      setPending(null)
    }
  }

  const returnLoan = (loanId: string) =>
    run(loanId, 'return', () =>
      apiClient.POST('/api/loans/{loanId}/return', { params: { path: { loanId } } }),
    )

  const renewLoan = (loanId: string) =>
    run(loanId, 'renew', () =>
      apiClient.POST('/api/loans/{loanId}/renew', { params: { path: { loanId } } }),
    )

  const loans = state.status === 'success' ? state.data.map((loan) => updated[loan.id] ?? loan) : []

  return { state, loans, returnLoan, renewLoan, pending, actionFailure, lastSuccess }
}
