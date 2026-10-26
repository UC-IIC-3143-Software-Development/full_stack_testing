// Tests de la compuerta de ZAP con los reportes de ejemplo de tools/__fixtures__/evidence/zap.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { blockingAlerts, loadRules } from './check-alerts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const report = (name) =>
  JSON.parse(readFileSync(join(here, '..', '__fixtures__', 'evidence', 'zap', name), 'utf8'))

describe('check-alerts de ZAP', () => {
  const rules = loadRules()

  it('lee las reglas ignoradas sin confundir los comentarios', () => {
    assert.equal(rules.get('10035'), 'IGNORE')
    assert.equal(rules.get('40018'), 'FAIL')
    assert.equal(rules.has('#'), false)
  })

  it('no bloquea por alertas Medium e informativas', () => {
    assert.deepEqual(blockingAlerts(report('zap-frontend.json'), rules), [])
  })

  it('bloquea por una alerta High', () => {
    assert.deepEqual(blockingAlerts(report('zap-api.json'), rules), [
      { site: 'http://localhost:3001', id: '40018', name: 'SQL Injection' },
    ])
  })

  it('no bloquea una alerta High si su regla está ignorada con justificación', () => {
    const ignored = new Map([['40018', 'IGNORE']])
    assert.deepEqual(blockingAlerts(report('zap-api.json'), ignored), [])
  })
})
