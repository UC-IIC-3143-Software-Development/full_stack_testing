// Mutation testing con Stryker: cambia el código (por ejemplo > por >=) y verifica que algún
// test falle. Un mutante que sobrevive es un test que falta o una aserción débil.
// Es lento (corre los tests muchas veces), por eso va en el pipeline nightly y no en cada PR.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'npm',
  testRunner: 'jest',
  jest: { configFile: 'jest.unit.config.js', enableFindRelatedTests: true },
  mutate: ['src/**/domain/**/*.ts', 'src/**/application/**/*.ts', '!src/**/*.spec.ts'],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 85, low: 70, break: 60 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
}

export default config
