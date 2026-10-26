import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import playwright from 'eslint-plugin-playwright'

// La política de tests de la constitución (P4) también se verifica con el linter:
// así un agente de IA no puede "colar" mocks, esperas fijas ni tests sin ID de regla.
const TITLE_WITH_RULE_ID = '/^\\[[A-Z]+(-[A-Z0-9]+)+\\] /'

const testPolicy = {
  'no-restricted-syntax': [
    'error',
    {
      selector: `CallExpression[callee.name=/^(it|test)$/] > Literal:first-child[value!=${TITLE_WITH_RULE_ID}]`,
      message:
        'P1.4: el título del test debe empezar con el ID de la regla, por ejemplo "[LOAN-R2] ...".',
    },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'vi', property: 'fn', message: 'P4.3: usa objetos reales o fakes en memoria.' },
    { object: 'vi', property: 'mock', message: 'P4.3: usa MSW o fakes en memoria.' },
    { object: 'vi', property: 'spyOn', message: 'P4.3: verifica el resultado, no la interacción.' },
    {
      property: 'toBeTruthy',
      message: 'P4.6: aserción débil. Compara con el valor literal esperado.',
    },
    {
      property: 'toBeDefined',
      message: 'P4.6: aserción débil. Compara con el valor literal esperado.',
    },
    {
      property: 'waitForTimeout',
      message: 'P4.6: nada de esperas fijas. Usa aserciones web-first.',
    },
  ],
}

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    '.features-gen/**',
    '.stryker-tmp/**',
    '.lighthouseci/**',
    'coverage/**',
    'reports/**',
    'evidence/**',
    'playwright-report/**',
    'test-results/**',
    'public/mockServiceWorker.js',
    'src/shared/api/schema.d.ts',
    'next-env.d.ts',
  ]),
  {
    // ARCH-R7: los componentes y las rutas no llaman fetch directo, usan hooks.
    files: ['src/features/**/components/**/*.tsx', 'src/app/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'ARCH-R7: usa un hook de la feature que use shared/api.' },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: testPolicy,
  },
  {
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      ...testPolicy,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expectNoViolations'] }],
      // El parámetro `use` de los fixtures de Playwright no es el hook use() de React.
      'react-hooks/rules-of-hooks': 'off',
      // Los pasos BDD son funciones de playwright-bdd, no tests: sus expect son válidos.
      'playwright/no-standalone-expect': 'off',
    },
  },
])
