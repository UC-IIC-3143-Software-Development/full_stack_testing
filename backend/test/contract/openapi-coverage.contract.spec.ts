import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract, readHits, REPORTS_DIR } from '../support/openapi-contract'

// Este archivo corre al final (test/support/contract-sequencer.js).
describe('Cobertura del contrato OpenAPI', () => {
  it('[SPEC-ARCH-01] cada operationId del contrato tiene al menos un test de contrato que pasa', async () => {
    const { operations } = await loadContract()
    const hits = readHits()

    const report = operations.map((operation) => {
      const own = hits.filter((hit) => hit.operationId === operation.operationId)
      return {
        operationId: operation.operationId,
        method: operation.method,
        path: operation.path,
        statuses: [...new Set(own.map((hit) => hit.status))].sort((a, b) => a - b),
        passed: own.length > 0 && own.every((hit) => hit.passed),
      }
    })
    mkdirSync(REPORTS_DIR, { recursive: true })
    writeFileSync(
      resolve(REPORTS_DIR, 'contract-coverage.json'),
      `${JSON.stringify({ operations: report }, null, 2)}\n`,
    )

    expect(report.filter((entry) => entry.statuses.length === 0).map((e) => e.operationId)).toEqual(
      [],
    )
    expect(report.filter((entry) => !entry.passed).map((e) => e.operationId)).toEqual([])
  })
})
