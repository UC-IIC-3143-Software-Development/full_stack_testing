// Tests de integración: repositorios y restricciones de PostgreSQL real con Testcontainers.
const unit = require('./jest.unit.config')

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'integration',
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: unit.moduleFileExtensions,
  transform: unit.transform,
  testMatch: ['<rootDir>/src/**/*.int-spec.ts'],
  globalSetup: '<rootDir>/test/support/postgres-global-setup.ts',
  globalTeardown: '<rootDir>/test/support/postgres-global-teardown.ts',
  testTimeout: 60_000,
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports/junit', outputName: 'integration.xml' }],
  ],
}
