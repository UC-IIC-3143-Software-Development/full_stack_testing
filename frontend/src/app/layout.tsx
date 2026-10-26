import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ApiMockingProvider } from '@/providers/ApiMockingProvider'
import { SiteHeader } from './_components/SiteHeader'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Biblioteca UC', template: '%s | Biblioteca UC' },
  description: 'Catálogo y préstamos de la Biblioteca UC. Proyecto de ejemplo de IIC3143.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL">
      <body>
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido" className="page-container">
          <ApiMockingProvider>{children}</ApiMockingProvider>
        </main>
      </body>
    </html>
  )
}
