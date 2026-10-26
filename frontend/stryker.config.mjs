// Mutation testing (Stryker): cambia el código del dominio a propósito (por ejemplo `>` por `>=`)
// y verifica que algún test falle. Mide la CALIDAD de los tests, no solo la cobertura.
// Es lento, por eso en CI corre solo en el job nightly y no en cada PR.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  // Solo los tests del dominio: deben bastar para matar los mutantes de su propia capa.
  vitest: { configFile: 'vitest.mutation.config.mts', related: false },
  mutate: ['src/shared/domain/**/*.ts', '!src/shared/domain/**/*.test.ts'],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 90, low: 75, break: 70 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
}

export default config
