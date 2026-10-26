import { useState } from 'react'
import { apiClient } from '@/shared/api/client'
import { toApiFailure, type ApiFailure } from '@/shared/api/problem'
import type { Loan } from '@/shared/api/types'
import { useApiQuery } from '@/shared/api/use-api-query'

/**
 * Préstamos de un correo (listLoans) y devolución (returnLoan).
 * UI-LOAN-3: al devolver se reemplaza el préstamo en memoria, sin recargar la página.
 */
export function useLoans(borrowerEmail: string) {
  const { state } = useApiQuery<Loan[]>(`loans:${borrowerEmail}`, () =>
    apiClient.GET('/api/loans', { params: { query: { borrowerEmail } } }),
  )
  const [returned, setReturned] = useState<Record<string, Loan>>({})
  const [returning, setReturning] = useState<string | null>(null)
  const [returnFailure, setReturnFailure] = useState<{
    loanId: string
    failure: ApiFailure
  } | null>(null)

  async function returnLoan(loanId: string) {
    setReturning(loanId)
    setReturnFailure(null)
    try {
      const { data, error } = await apiClient.POST('/api/loans/{loanId}/return', {
        params: { path: { loanId } },
      })
      if (data) setReturned((prev) => ({ ...prev, [loanId]: data }))
      else setReturnFailure({ loanId, failure: toApiFailure(error) })
    } catch (error) {
      setReturnFailure({ loanId, failure: toApiFailure(error) })
    } finally {
      setReturning(null)
    }
  }

  const loans =
    state.status === 'success' ? state.data.map((loan) => returned[loan.id] ?? loan) : []

  return { state, loans, returnLoan, returning, returnFailure }
}
