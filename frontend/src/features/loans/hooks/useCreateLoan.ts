import { useState } from 'react'
import { apiClient } from '@/shared/api/client'
import { toApiFailure, type ApiFailure } from '@/shared/api/problem'
import type { Loan } from '@/shared/api/types'

export type CreateLoanResult =
  | {
      ok: true
      loan: Loan
    }
  | {
      ok: false
      failure: ApiFailure
    }

/** Registra un préstamo (createLoan). */
export function useCreateLoan() {
  const [pending, setPending] = useState(false)

  async function createLoan(bookId: string, borrowerEmail: string): Promise<CreateLoanResult> {
    setPending(true)
    try {
      const { data, error } = await apiClient.POST('/api/loans', {
        body: { bookId, borrowerEmail },
      })
      return data ? { ok: true, loan: data } : { ok: false, failure: toApiFailure(error) }
    } catch (error) {
      return { ok: false, failure: toApiFailure(error) }
    } finally {
      setPending(false)
    }
  }

  return { createLoan, pending }
}
