// ESLint (flat config): reglas de TypeScript con información de tipos, reglas de seguridad
// (eslint-plugin-security, un SAST liviano que corre en segundos) y Prettier para el formato.
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import security from 'eslint-plugin-security'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'reports/', '.stryker-tmp/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Los repositorios en memoria implementan interfaces async sin await.
      '@typescript-eslint/require-await': 'off',
      // Esta regla marca cualquier obj[clave] y con TypeScript da casi solo falsos positivos.
      // Ajustar el ruido del SAST también es parte del trabajo: Semgrep cubre inyecciones en CI.
      'security/detect-object-injection': 'off',
    },
  },
  {
    // Política de tests (constitución P4): sin mocks ni esperas fijas.
    files: ['**/*.spec.ts', '**/*.int-spec.ts', 'test/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'jest', property: 'fn', message: 'Usa un fake en memoria (P4.3).' },
        { object: 'jest', property: 'mock', message: 'Usa un fake en memoria (P4.3).' },
        { object: 'jest', property: 'spyOn', message: 'Verifica estado, no llamadas (P4.3).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toBeDefined']",
          message: 'Aserción débil: escribe el valor esperado literal (P4.4).',
        },
        {
          selector: "CallExpression[callee.property.name='toBeTruthy']",
          message: 'Aserción débil: escribe el valor esperado literal (P4.4).',
        },
        {
          selector: "CallExpression[callee.name='setTimeout']",
          message: 'Nada de esperas fijas en los tests (P4.6).',
        },
      ],
      // supertest y los errores capturados devuelven any. En tests se acepta.
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Los tests leen y escriben reports/ y specs/ con rutas armadas desde __dirname.
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  prettier,
)
