import { STATUS_CODES } from 'node:http'
import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'
import { DomainError, DomainValidationError, type ErrorCode } from '../domain/domain-error'
import {
  MethodNotAllowedError,
  RequestValidationError,
  type FieldError,
} from './openapi/request-validation.error'

/** Cuerpo de error RFC 9457 (schema Problem del contrato). */
export interface Problem {
  type: string
  title: string
  status: number
  code?: ErrorCode
  detail?: string
  errors?: FieldError[]
}

/** Traducción de cada error de negocio a un status HTTP. El dominio no conoce HTTP. */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BOOK_NOT_FOUND: 404,
  LOAN_NOT_FOUND: 404,
  ISBN_ALREADY_EXISTS: 409,
  NO_COPIES_AVAILABLE: 409,
  LOAN_LIMIT_REACHED: 409,
  DUPLICATE_LOAN: 409,
  ALREADY_RETURNED: 409,
}

const VALIDATION_DETAIL = 'La solicitud tiene campos inválidos'

/** Convierte cualquier error en application/problem+json. Ninguna respuesta de error sale con otro formato. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const problem = toProblem(exception)
    if (problem.status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : exception,
      )
    }
    if (response.headersSent) {
      return
    }
    if (exception instanceof MethodNotAllowedError) {
      response.setHeader('Allow', exception.allowed.join(', '))
    }
    response.status(problem.status).type('application/problem+json').json(problem)
  }
}

export function toProblem(exception: unknown): Problem {
  if (exception instanceof RequestValidationError) {
    return validationProblem(exception.errors)
  }
  if (exception instanceof MethodNotAllowedError) {
    return problem(405, exception.message)
  }
  if (exception instanceof DomainValidationError) {
    return validationProblem([{ field: exception.field, message: exception.message }])
  }
  if (exception instanceof DomainError) {
    return problem(STATUS_BY_CODE[exception.code], exception.message, exception.code)
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    if (status === 400) {
      return validationProblem([{ field: 'body', message: 'El cuerpo no es un JSON válido' }])
    }
    if (status === 404) return problem(404, 'La ruta no existe')
    return problem(status, messageOf(exception.getResponse()) ?? exception.message)
  }
  // Errores de Express, por ejemplo un JSON mal formado (body-parser) o un cuerpo muy grande.
  const status = statusOf(exception)
  if (status === 400) {
    return validationProblem([{ field: 'body', message: 'El cuerpo no es un JSON válido' }])
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return problem(status, 'La solicitud no se puede procesar')
  }
  return problem(500, 'Ocurrió un error inesperado')
}

function validationProblem(errors: FieldError[]): Problem {
  return {
    ...problem(400, VALIDATION_DETAIL, 'VALIDATION_ERROR'),
    errors,
  }
}

function problem(status: number, detail: string, code?: ErrorCode): Problem {
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    ...(code ? { code } : {}),
    detail,
  }
}

/** Forma de los errores de Express y body-parser (http-errors). */
interface HttpLikeError {
  status?: unknown
  statusCode?: unknown
}

function statusOf(exception: unknown): number | undefined {
  if (exception !== null && typeof exception === 'object') {
    const { status, statusCode } = exception as HttpLikeError
    const value = status ?? statusCode
    return typeof value === 'number' ? value : undefined
  }
  return undefined
}

function messageOf(body: string | object): string | undefined {
  if (typeof body === 'string') return body
  const message = (body as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}
