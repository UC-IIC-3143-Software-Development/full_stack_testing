'use client'

import { useRouter } from 'next/navigation'
import { NewBookForm } from '@/features/catalog/components/NewBookForm'

/** Composición: al crear el libro vuelve al catálogo con el aviso "Libro agregado". */
export function NewBookScreen() {
  const router = useRouter()
  return <NewBookForm onCreated={() => router.push('/?agregado=1')} />
}
