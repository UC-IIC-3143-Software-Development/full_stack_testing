// Tests unitarios: dominio sin dobles y aplicación con fakes en memoria. Sin base de datos.
/** @type {import('jest').Config} */
module.exports = {
  displayName: 'unit',
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.contract\\.spec\\.ts$', '\\.int-spec\\.ts$'],
  collectCoverageFrom: ['src/**/{domain,application}/**/*.ts', '!src/**/*.spec.ts'],
  coverageDirectory: 'reports/coverage',
  coverageReporters: ['text-summary', 'lcov', 'json-summary', 'cobertura'],
  // El umbral evita retrocesos, no es la meta. La calidad de los tests se mide mejor con
  // mutation testing (npm run test:mutation). Las carreras entre transacciones se prueban
  // en test:integration, por eso algunas ramas no se cubren aquí.
  coverageThreshold: { global: { lines: 85, branches: 80 } },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports/junit', outputName: 'unit.xml' }],
  ],
}
