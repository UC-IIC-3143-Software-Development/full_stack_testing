// Reglas de arquitectura del frontend (specs/architecture.md). Cada regla lleva su ID
// en el nombre, así el reporte de CI apunta directo a la spec que se rompió.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'ARCH-R6-dominio-puro',
      comment:
        'shared/domain son funciones puras: no importa React, Next, shared/api ni otras capas.',
      severity: 'error',
      from: { path: '^src/shared/domain' },
      to: {
        path: [
          '^src/(app|features|mocks|providers|shared/api)',
          '(^|/)node_modules/(react|react-dom|next)/',
        ],
      },
    },
    {
      name: 'ARCH-R6-dominio-sin-dependencias-npm',
      comment: 'El dominio solo usa TypeScript: cualquier paquete npm es una dependencia de más.',
      severity: 'error',
      from: { path: '^src/shared/domain' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'] },
    },
    {
      name: 'ARCH-R7-componentes-usan-hooks',
      comment:
        'Los componentes no llaman a la API: usan hooks de su feature. Importar solo tipos está permitido.',
      severity: 'error',
      from: { path: '^src/features/[^/]+/components' },
      to: {
        path: ['^src/shared/api/(client|use-api-query)', '(^|/)node_modules/openapi-fetch/'],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'ARCH-R7-hooks-sin-componentes',
      comment: 'Los hooks no dependen de componentes (la dependencia va de UI hacia hooks).',
      severity: 'error',
      from: { path: '^src/features/[^/]+/hooks' },
      to: { path: '^src/features/[^/]+/components' },
    },
    {
      name: 'ARCH-R8-app-sin-mocks',
      comment: 'app no importa mocks. MSW se activa solo por variable de entorno en providers/.',
      severity: 'error',
      from: { path: '^src/app' },
      to: { path: '^src/mocks' },
    },
    {
      name: 'ARCH-R8-codigo-sin-mocks',
      comment: 'Solo providers/ y los tests pueden importar el mock server.',
      severity: 'error',
      from: { path: '^src/(features|shared)', pathNot: '\\.test\\.tsx?$' },
      to: { path: '^src/mocks' },
    },
    {
      name: 'ARCH-R4-sin-ciclos',
      comment: 'Sin dependencias circulares.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.d\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
