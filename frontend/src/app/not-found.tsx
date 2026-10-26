import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Página no encontrada</h1>
      <Link href="/">Volver al catálogo</Link>
    </div>
  )
}
