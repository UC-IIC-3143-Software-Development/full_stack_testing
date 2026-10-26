import Link from 'next/link'
import { Catalog } from '@/features/catalog/components/Catalog'
import styles from './page.module.css'

interface CatalogPageProps {
  searchParams: Promise<{ agregado?: string }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { agregado } = await searchParams
  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1>Catálogo</h1>
        <Link href="/libros/nuevo" className="button">
          Agregar libro
        </Link>
      </div>
      {agregado && (
        <p role="status" className="notice">
          Libro agregado
        </p>
      )}
      <Catalog />
    </div>
  )
}
