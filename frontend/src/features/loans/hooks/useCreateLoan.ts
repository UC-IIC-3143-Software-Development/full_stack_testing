import { useState } from 'react'
import { apiClient } from '@/shared/api/client'
import { fieldErrorsOf, toApiFailure, type ApiFailure } from '@/shared/api/problem'
import type { Loan } from '@/shared/api/types'

export type CreateLoanResult =
  | {
      ok: true
      loan: Loan
    }
  | {
      ok: false
      failure: ApiFailure
      /** Errores por campo de un 400 (campo a mensaje), así el componente no importa shared/api. */
      fieldErrors: Record<string, string>
    }

function failed(error: unknown): CreateLoanResult {
  const failure = toApiFailure(error)
  return { ok: false, failure, fieldErrors: fieldErrorsOf(failure) }
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
      return data ? { ok: true, loan: data } : failed(error)
    } catch (error) {
      return failed(error)
    } finally {
      setPending(false)
    }
  }

  return { createLoan, pending }
}
