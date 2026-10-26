// Reglas de arquitectura de specs/architecture.md, verificadas en CI con `npm run test:arch`.
// Cada regla lleva su ID para que el mensaje de error apunte a la spec.
//
// Raíz de composición (sin reglas de capa): src/main.ts, src/app.*.ts, src/*/*.module.ts y
// src/database/. Son los únicos archivos que conocen todas las capas y conectan puertos con
// adaptadores. `shared` es el núcleo compartido: un módulo puede usar la capa equivalente de shared.
const LAYER = (layer) => `^src/[^/]+/${layer}/`

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'ARCH-R1-dominio-puro',
      comment:
        'ARCH-R1: domain no importa @nestjs, typeorm, pg ni otras capas. Solo TypeScript y otros domain.',
      severity: 'error',
      from: { path: LAYER('domain') },
      to: { pathNot: LAYER('domain') },
    },
    {
      name: 'ARCH-R2-aplicacion-sin-adaptadores',
      comment:
        'ARCH-R2: application no importa infrastructure ni presentation, ni frameworks. Depende de puertos.',
      severity: 'error',
      from: { path: LAYER('application') },
      to: {
        path: [
          LAYER('infrastructure'),
          LAYER('presentation'),
          '^src/database/',
          '\\.module\\.ts$',
          'node_modules/(@nestjs|typeorm|pg)/',
        ],
      },
    },
    {
      name: 'ARCH-R3-presentacion-sin-infraestructura',
      comment: 'ARCH-R3: presentation no importa infrastructure (no accede a repositorios).',
      severity: 'error',
      from: { path: LAYER('presentation') },
      to: { path: [LAYER('infrastructure'), '^src/database/', 'node_modules/(typeorm|pg)/'] },
    },
    {
      name: 'ARCH-R4-sin-ciclos',
      comment: 'ARCH-R4: no hay dependencias circulares.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'ARCH-R5-modulos-por-su-api-publica',
      comment:
        'ARCH-R5: un módulo no importa infrastructure ni presentation de otro módulo (salvo shared).',
      severity: 'error',
      from: { path: '^src/([^/]+)/(domain|application|infrastructure|presentation)/' },
      to: {
        path: '^src/[^/]+/(infrastructure|presentation)/',
        pathNot: ['^src/$1/', '^src/shared/'],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.spec\\.ts$', '\\.int-spec\\.ts$'] },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
