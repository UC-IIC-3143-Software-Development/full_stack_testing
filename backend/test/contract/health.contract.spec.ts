import request from 'supertest'
import { startApp, type RunningApp } from '../support/contract-app'
import { expectToMatchContract } from '../support/openapi-contract'

describe('Contrato HTTP: health', () => {
  let running: RunningApp

  beforeAll(async () => {
    running = await startApp()
  })

  afterAll(async () => {
    await running.app.close()
  })

  it('[SPEC-ARCH-01] GET /api/health responde ok cuando la base de datos responde', async () => {
    const response = await request(running.http).get('/api/health')

    await expectToMatchContract(response, 'getHealth')
    expect(response.body).toEqual({ status: 'ok' })
  })
})
