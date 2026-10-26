import type { Metadata } from 'next'
import Link from 'next/link'
import { BookScreen } from './BookScreen'

export const metadata: Metadata = { title: 'Detalle del libro' }

export default async function BookPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  return (
    <div className="stack">
      <Link href="/">Volver al catálogo</Link>
      <BookScreen bookId={id} />
    </div>
  )
}
