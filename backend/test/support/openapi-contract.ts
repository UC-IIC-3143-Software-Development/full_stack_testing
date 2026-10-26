import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import type { Response } from 'supertest'

/**
 * Oráculo de los tests de contrato: specs/api/openapi.yaml. Es independiente del validador
 * de requests del backend (src/shared/presentation/openapi), para no compartir sus errores.
 */
export const CONTRACT_PATH = resolve(__dirname, '..', '..', '..', 'specs', 'api', 'openapi.yaml')
export const REPORTS_DIR = resolve(__dirname, '..', '..', 'reports')
export const HITS_FILE = resolve(REPORTS_DIR, '.contract-hits.jsonl')

interface ResponseObject {
  content?: Record<string, { schema: object }>
}

export interface ContractOperation {
  operationId: string
  method: string
  path: string
  responses: Record<string, ResponseObject>
}

export interface ContractHit {
  operationId: string
  status: number
  passed: boolean
}

interface Contract {
  operations: ContractOperation[]
  validatorFor(operationId: string, status: number, mediaType: string): ValidateFunction
}

let contract: Promise<Contract> | undefined

export function loadContract(): Promise<Contract> {
  contract ??= buildContract()
  return contract
}

async function buildContract(): Promise<Contract> {
  const document = (await SwaggerParser.dereference(CONTRACT_PATH)) as unknown as {
    paths: Record<string, Record<string, Omit<ContractOperation, 'method' | 'path'>>>
  }
  const operations: ContractOperation[] = []
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      operations.push({ ...operation, method: method.toUpperCase(), path })
    }
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const cache = new Map<string, ValidateFunction>()

  return {
    operations,
    validatorFor(operationId, status, mediaType) {
      const key = `${operationId} ${status} ${mediaType}`
      const cached = cache.get(key)
      if (cached) return cached
      const schema = findOperation(operations, operationId).responses[String(status)]?.content?.[
        mediaType
      ]?.schema
      if (!schema) {
        throw new Error(`${operationId} no documenta ${status} con ${mediaType}`)
      }
      const validate = ajv.compile(schema)
      cache.set(key, validate)
      return validate
    },
  }
}

export function findOperation(operations: ContractOperation[], operationId: string) {
  const operation = operations.find((candidate) => candidate.operationId === operationId)
  if (!operation) {
    throw new Error(`El contrato no tiene la operación ${operationId}`)
  }
  return operation
}

/**
 * Verifica que la respuesta cumple el contrato: status documentado, Content-Type documentado
 * y cuerpo válido según el schema. Deja registro para el reporte de cobertura del contrato.
 */
export async function expectToMatchContract(
  response: Response,
  operationId: string,
): Promise<void> {
  const { operations, validatorFor } = await loadContract()
  const operation = findOperation(operations, operationId)
  try {
    const documented = operation.responses[String(response.status)]
    if (!documented) {
      throw new Error(
        `${operationId} respondió ${response.status}, que no está documentado ` +
          `(documentados: ${Object.keys(operation.responses).join(', ')})\n${response.text}`,
      )
    }
    const mediaType = response.type // Content-Type sin parámetros (sin charset)
    const documentedTypes = Object.keys(documented.content ?? {})
    if (!documentedTypes.includes(mediaType)) {
      throw new Error(
        `${operationId} ${response.status} respondió Content-Type "${mediaType}" ` +
          `y el contrato espera ${documentedTypes.join(' o ')}`,
      )
    }
    const validate = validatorFor(operationId, response.status, mediaType)
    if (!validate(response.body)) {
      throw new Error(
        `${operationId} ${response.status}: el cuerpo no cumple el schema del contrato\n` +
          `${JSON.stringify(validate.errors, null, 2)}\n${response.text}`,
      )
    }
    recordHit({ operationId, status: response.status, passed: true })
  } catch (error) {
    recordHit({ operationId, status: response.status, passed: false })
    throw error
  }
}

// Jest aísla los módulos de cada archivo de test, por eso los registros van a un archivo.
function recordHit(hit: ContractHit): void {
  mkdirSync(dirname(HITS_FILE), { recursive: true })
  appendFileSync(HITS_FILE, `${JSON.stringify(hit)}\n`)
}

export function readHits(): ContractHit[] {
  if (!existsSync(HITS_FILE)) return []
  return readFileSync(HITS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ContractHit)
}
