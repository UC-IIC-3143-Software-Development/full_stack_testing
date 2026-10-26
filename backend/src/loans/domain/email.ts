import { DomainValidationError } from '../../shared/domain/domain-error'

export const EMAIL_MAX_LENGTH = 254
export const INVALID_EMAIL_MESSAGE = 'El correo no es válido'

/** Value object del correo de quien pide el préstamo (LOAN-R7). */
export class Email {
  private constructor(readonly value: string) {}

  /** Normaliza a minúsculas y sin espacios alrededor, y valida el formato. */
  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase()
    if (normalized.length > EMAIL_MAX_LENGTH || !hasEmailShape(normalized)) {
      throw new DomainValidationError('borrowerEmail', INVALID_EMAIL_MESSAGE)
    }
    return new Email(normalized)
  }

  equals(other: Email): boolean {
    return this.value === other.value
  }
}

/** Una parte local, una sola arroba y un dominio con al menos un punto. Sin espacios. */
function hasEmailShape(value: string): boolean {
  const [local, domain, ...rest] = value.split('@')
  if (rest.length > 0 || !local || !domain || /\s/.test(value)) {
    return false
  }
  const labels = domain.split('.')
  return labels.length >= 2 && labels.every((label) => label.length > 0)
}
