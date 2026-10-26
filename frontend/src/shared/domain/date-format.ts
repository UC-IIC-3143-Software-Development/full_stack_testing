// UI-LOAN-1. Las fechas viajan en UTC y se muestran como dd-mm-aaaa en hora de Chile.

const TIME_ZONE = 'America/Santiago'

const formatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** "2026-03-16T12:00:00Z" pasa a "16-03-2026". */
export function formatDate(isoDate: string): string {
  const parts = formatter.formatToParts(new Date(isoDate))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('day')}-${get('month')}-${get('year')}`
}
