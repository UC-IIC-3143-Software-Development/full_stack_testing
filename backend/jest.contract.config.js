// Tests de contrato: la app Nest completa contra PostgreSQL (Testcontainers), por HTTP con
// supertest, validando cada respuesta contra specs/api/openapi.yaml. Corre con --runInBand.
const unit = require('./jest.unit.config')

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'contract',
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: unit.moduleFileExtensions,
  transform: unit.transform,
  testMatch: ['<rootDir>/test/contract/**/*.contract.spec.ts'],
  globalSetup: '<rootDir>/test/support/contract-global-setup.ts',
  globalTeardown: '<rootDir>/test/support/postgres-global-teardown.ts',
  testSequencer: '<rootDir>/test/support/contract-sequencer.js',
  testTimeout: 60_000,
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports/junit', outputName: 'contract.xml' }],
  ],
}
