/** Un campo inválido, igual al schema FieldError del contrato. */
export interface FieldError {
  field: string
  message: string
}

/** La solicitud no cumple specs/api/openapi.yaml. El filtro la convierte en 400 VALIDATION_ERROR. */
export class RequestValidationError extends Error {
  constructor(readonly errors: FieldError[]) {
    super('La solicitud no cumple el contrato')
    this.name = 'RequestValidationError'
  }
}

/** La ruta existe en el contrato, pero no con este método. El filtro responde 405 con Allow. */
export class MethodNotAllowedError extends Error {
  constructor(readonly allowed: string[]) {
    super(`Método no permitido. Usa ${allowed.join(', ')}`)
    this.name = 'MethodNotAllowedError'
  }
}
