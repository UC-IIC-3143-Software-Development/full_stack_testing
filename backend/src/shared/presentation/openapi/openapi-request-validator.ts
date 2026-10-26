import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import {
  HTTP_METHODS,
  loadOpenApiDocument,
  type OpenApiDocument,
  type ParameterObject,
} from './openapi-document'
import type { FieldError } from './request-validation.error'

/** Datos de la solicitud que se validan (independiente de Express para poder probarlo). */
export interface RequestToValidate {
  method: string
  /** Ruta tal como llegó, todavía codificada (sin la query). */
  rawPath: string
  query: Record<string, unknown>
  body: unknown
  /** true si el Content-Type es JSON. */
  isJson: boolean
}

interface CompiledParameter {
  name: string
  required: boolean
  validate: ValidateFunction
}

interface CompiledOperation {
  operationId: string
  method: string
  pattern: RegExp
  pathParameters: CompiledParameter[]
  queryParameters: CompiledParameter[]
  body?: CompiledBody
}

interface CompiledBody {
  required: boolean
  validate: ValidateFunction
}

// ajv-formats acepta "urn:uuid:..." como UUID, pero PostgreSQL no. Usamos la forma estricta.
const STRICT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Valida las solicitudes contra specs/api/openapi.yaml. El contrato es la única fuente de
 * verdad: no hay DTOs con decoradores que dupliquen los schemas.
 */
export class OpenApiRequestValidator {
  private constructor(private readonly operations: CompiledOperation[]) {}

  static async fromFile(path: string): Promise<OpenApiRequestValidator> {
    return OpenApiRequestValidator.fromDocument(await loadOpenApiDocument(path))
  }

  static fromDocument(document: OpenApiDocument): OpenApiRequestValidator {
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    ajv.addFormat('uuid', STRICT_UUID)

    const operations: CompiledOperation[] = []
    for (const [template, pathItem] of Object.entries(document.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method]
        if (!operation) continue
        const parameters = operation.parameters ?? []
        const jsonBody = operation.requestBody?.content['application/json']
        operations.push({
          operationId: operation.operationId,
          method: method.toUpperCase(),
          pattern: templateToRegExp(template),
          pathParameters: compileParameters(ajv, parameters, 'path'),
          queryParameters: compileParameters(ajv, parameters, 'query'),
          body: jsonBody
            ? {
                required: operation.requestBody?.required ?? false,
                validate: ajv.compile(jsonBody.schema),
              }
            : undefined,
        })
      }
    }
    return new OpenApiRequestValidator(operations)
  }

  /**
   * Métodos que el contrato declara para esta ruta (por ejemplo ['GET', 'POST']) o null si la
   * ruta no está en el contrato. Sirve para responder 405 a un método no declarado.
   */
  allowedMethods(rawPath: string): string[] | null {
    const methods = this.operations
      .filter((operation) => operation.pattern.test(rawPath))
      .map((operation) => operation.method)
    return methods.length > 0 ? methods : null
  }

  /** Devuelve los errores encontrados, una lista vacía si es válida o null si la ruta no está en el contrato. */
  validate(request: RequestToValidate): FieldError[] | null {
    const method = request.method.toUpperCase()
    for (const operation of this.operations) {
      if (operation.method !== method) continue
      const match = operation.pattern.exec(request.rawPath)
      if (!match) continue
      return [
        ...this.validatePath(operation, match.slice(1)),
        ...this.validateQuery(operation, request.query),
        ...this.validateBody(operation, request),
      ]
    }
    return null
  }

  private validatePath(operation: CompiledOperation, rawValues: string[]): FieldError[] {
    const errors: FieldError[] = []
    operation.pathParameters.forEach((parameter, index) => {
      const value = safeDecode(rawValues[index] ?? '')
      if (value === null) {
        errors.push({ field: parameter.name, message: 'El valor no es válido' })
      } else if (!parameter.validate(value)) {
        errors.push({ field: parameter.name, message: messageFor(parameter.validate.errors) })
      }
    })
    return errors
  }

  private validateQuery(
    operation: CompiledOperation,
    query: Record<string, unknown>,
  ): FieldError[] {
    const errors: FieldError[] = []
    for (const parameter of operation.queryParameters) {
      const value = query[parameter.name]
      if (value === undefined) {
        if (parameter.required) {
          errors.push({ field: parameter.name, message: 'El parámetro es obligatorio' })
        }
      } else if (typeof value !== 'string') {
        // ?q=a&q=b llega como arreglo. El contrato define un solo valor.
        errors.push({ field: parameter.name, message: 'El parámetro debe aparecer una sola vez' })
      } else if (value.includes('\u0000')) {
        errors.push({ field: parameter.name, message: NUL_MESSAGE })
      } else if (!parameter.validate(value)) {
        errors.push({ field: parameter.name, message: messageFor(parameter.validate.errors) })
      }
    }
    return errors
  }

  private validateBody(operation: CompiledOperation, request: RequestToValidate): FieldError[] {
    if (!operation.body) return []
    if (request.body === undefined || !request.isJson) {
      return operation.body.required
        ? [
            {
              field: 'body',
              message: 'El cuerpo es obligatorio y debe ser JSON (application/json)',
            },
          ]
        : []
    }
    const nulField = findNulCharacter(request.body)
    if (nulField !== null) {
      return [{ field: nulField || 'body', message: NUL_MESSAGE }]
    }
    if (operation.body.validate(request.body)) return []
    return toFieldErrors(operation.body.validate.errors ?? [])
  }
}

// PostgreSQL no puede guardar el carácter nulo en un texto. Lo rechazamos aquí con un 400
// en vez de dejar que la base de datos responda con un error 500.
const NUL_MESSAGE = 'No puede contener el carácter nulo'

function compileParameters(
  ajv: Ajv2020,
  parameters: ParameterObject[],
  location: 'path' | 'query',
): CompiledParameter[] {
  return parameters
    .filter((parameter) => parameter.in === location)
    .map((parameter) => ({
      name: parameter.name,
      required: parameter.required ?? location === 'path',
      validate: ajv.compile(parameter.schema),
    }))
}

/** "/api/books/{bookId}" se transforma en /^\/api\/books\/([^/]+)\/?$/i (Express no distingue mayúsculas). */
function templateToRegExp(template: string): RegExp {
  const source = template
    .split(/\{[^}]+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('([^/]+)')
  // eslint-disable-next-line security/detect-non-literal-regexp -- se construye desde el contrato, no desde el usuario
  return new RegExp(`^${source}/?$`, 'i')
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/** Devuelve la ruta del primer texto con carácter nulo ("" si es la raíz) o null si no hay. */
function findNulCharacter(value: unknown, path = ''): string | null {
  if (typeof value === 'string') return value.includes('\u0000') ? path : null
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findNulCharacter(item, path ? `${path}.${index}` : String(index))
      if (found !== null) return found
    }
    return null
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key.includes('\u0000')) return path || 'body'
      const found = findNulCharacter(item, path ? `${path}.${key}` : key)
      if (found !== null) return found
    }
  }
  return null
}

function toFieldErrors(errors: ErrorObject[]): FieldError[] {
  const seen = new Set<string>()
  const result: FieldError[] = []
  for (const error of errors) {
    const field = fieldOf(error)
    if (seen.has(field)) continue
    seen.add(field)
    result.push({ field, message: messageFor([error]) })
  }
  return result
}

function fieldOf(error: ErrorObject): string {
  const base = error.instancePath.split('/').filter(Boolean).join('.')
  const extra =
    error.keyword === 'required'
      ? (error.params as { missingProperty: string }).missingProperty
      : error.keyword === 'additionalProperties'
        ? (error.params as { additionalProperty: string }).additionalProperty
        : ''
  return [base, extra].filter(Boolean).join('.') || 'body'
}

const TYPE_NAMES: Record<string, string> = {
  string: 'texto',
  integer: 'número entero',
  number: 'número',
  object: 'objeto',
  array: 'arreglo',
  boolean: 'booleano',
}

/** Mensajes en español para los errores de JSON Schema que pueden aparecer en este contrato. */
function messageFor(errors: ErrorObject[] | null | undefined): string {
  const error = errors?.[0]
  if (!error) return 'El valor no es válido'
  const params = error.params as Record<string, unknown>
  switch (error.keyword) {
    case 'required':
      return 'El campo es obligatorio'
    case 'additionalProperties':
      return 'El campo no está permitido'
    case 'type':
      return `Debe ser de tipo ${TYPE_NAMES[String(params.type)] ?? String(params.type)}`
    case 'format':
      return params.format === 'email'
        ? 'Debe ser un correo válido'
        : params.format === 'uuid'
          ? 'Debe ser un UUID válido'
          : `No cumple el formato ${String(params.format)}`
    case 'minLength':
      return `Debe tener al menos ${String(params.limit)} caracteres`
    case 'maxLength':
      return `Debe tener como máximo ${String(params.limit)} caracteres`
    case 'minimum':
      return `Debe ser mayor o igual a ${String(params.limit)}`
    case 'maximum':
      return `Debe ser menor o igual a ${String(params.limit)}`
    case 'pattern':
      return 'No tiene el formato esperado'
    case 'enum':
      return 'No es un valor permitido'
    default:
      return 'El valor no es válido'
  }
}
