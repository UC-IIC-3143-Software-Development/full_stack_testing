/**
 * Códigos de error del negocio. Son los mismos del enum `ErrorCode` de
 * specs/api/openapi.yaml. Si alguien agrega uno aquí y no en el contrato,
 * los tests de contrato fallan (la respuesta no cumple el schema).
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BOOK_NOT_FOUND'
  | 'LOAN_NOT_FOUND'
  | 'ISBN_ALREADY_EXISTS'
  | 'NO_COPIES_AVAILABLE'
  | 'LOAN_LIMIT_REACHED'
  | 'DUPLICATE_LOAN'
  | 'ALREADY_RETURNED'
  | 'RENEWAL_LIMIT_REACHED'
  | 'LOAN_OVERDUE'

/** Error de negocio. El dominio no sabe de HTTP: la capa presentation traduce `code` a un status. */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** Un dato de entrada no cumple una regla del dominio (por ejemplo BOOK-R1 o LOAN-R7). */
export class DomainValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
  }
}
