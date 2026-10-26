import styles from './AvailabilityBadge.module.css'

/** UI-CAT-2: verde "Disponible (n)" si hay copias, rojo "Agotado" si no hay. */
export function AvailabilityBadge({ availableCopies }: { availableCopies: number }) {
  const available = availableCopies > 0
  return (
    <span className={`${styles.badge} ${available ? styles.available : styles.soldOut}`}>
      {available ? `Disponible (${availableCopies})` : 'Agotado'}
    </span>
  )
}
