'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './SiteHeader.module.css'

const LINKS = [
  { href: '/', label: 'Catálogo' },
  { href: '/prestamos', label: 'Mis préstamos' },
]

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Biblioteca UC
        </Link>
        <nav aria-label="Principal">
          <ul className={styles.links}>
            {LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={styles.link}
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
