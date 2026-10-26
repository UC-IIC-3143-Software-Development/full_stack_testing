import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { OpenApiRequestValidator } from './openapi-request-validator'
import { MethodNotAllowedError, RequestValidationError } from './request-validation.error'

/**
 * Valida cada solicitud contra el contrato antes de llegar al controller.
 * Corre después del body parser de Nest, así que req.body ya es JSON.
 */
@Injectable()
export class OpenApiValidationMiddleware implements NestMiddleware {
  constructor(private readonly validator: OpenApiRequestValidator) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const rawPath = request.originalUrl.split('?')[0]
    // HEAD se responde como GET (Express lo hace solo). Cualquier otro método no declarado: 405.
    const method = request.method === 'HEAD' ? 'GET' : request.method
    const allowed = this.validator.allowedMethods(rawPath)
    if (allowed && !allowed.includes(method)) {
      throw new MethodNotAllowedError(allowed)
    }
    const errors = this.validator.validate({
      method,
      rawPath,
      query: request.query,
      body: request.body,
      isJson: request.is('application/json') === 'application/json',
    })
    if (errors && errors.length > 0) {
      throw new RequestValidationError(errors)
    }
    next()
  }
}
