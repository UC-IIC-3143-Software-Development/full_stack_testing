import type { Metadata } from 'next'
import { LoansLookup } from '@/features/loans/components/LoansLookup'

export const metadata: Metadata = { title: 'Mis préstamos' }

export default function LoansPage() {
  return (
    <div className="stack">
      <h1>Mis préstamos</h1>
      <LoansLookup />
    </div>
  )
}
