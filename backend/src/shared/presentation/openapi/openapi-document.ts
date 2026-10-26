import SwaggerParser from '@apidevtools/swagger-parser'

/** Subconjunto de OpenAPI 3.1 que usa el backend (ya desreferenciado, sin $ref). */
export interface JsonSchema {
  [keyword: string]: unknown
}

export interface ParameterObject {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  schema: JsonSchema
}

export interface OperationObject {
  operationId: string
  parameters?: ParameterObject[]
  requestBody?: {
    required?: boolean
    content: Record<string, { schema: JsonSchema }>
  }
  responses: Record<string, unknown>
}

export interface OpenApiDocument {
  openapi: string
  paths: Record<string, Partial<Record<HttpMethod, OperationObject>>>
}

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

/** Lee specs/api/openapi.yaml y resuelve todos los $ref. */
export async function loadOpenApiDocument(path: string): Promise<OpenApiDocument> {
  const document = await SwaggerParser.dereference(path)
  return document as unknown as OpenApiDocument
}
