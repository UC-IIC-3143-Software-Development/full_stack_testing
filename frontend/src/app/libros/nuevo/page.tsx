import type { Metadata } from 'next'
import Link from 'next/link'
import { NewBookScreen } from './NewBookScreen'

export const metadata: Metadata = { title: 'Agregar libro' }

export default function NewBookPage() {
  return (
    <div className="stack">
      <Link href="/">Volver al catálogo</Link>
      <h1>Agregar libro</h1>
      <NewBookScreen />
    </div>
  )
}
