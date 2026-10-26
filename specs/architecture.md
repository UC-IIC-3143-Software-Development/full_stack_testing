# Arquitectura

| Campo             | Valor                                                       |
| ----------------- | ----------------------------------------------------------- |
| ID                | SPEC-ARCH-01 · versión 1                                    |
| Verificación      | `npm run test:arch` en `backend/` y `frontend/` (dependency-cruiser) |
| Specs relacionadas | `constitution.md`, `api/openapi.yaml`                      |

## Vista general (monorepo)

```
full_stack_testing/
├── specs/                 Fuente de verdad: constitución, arquitectura, OpenAPI, features, flujos
├── backend/               API REST NestJS + PostgreSQL (TypeORM)
├── frontend/              Next.js (App Router) + MSW
├── tools/                 Scripts de CI: trazabilidad de specs, presupuesto de tests, evidencia
├── .github/workflows/     Pipeline de CI con DevSecOps
├── docs/                  Presentación y diagramas de la clase
└── docker-compose.yml     Stack completo para pruebas de sistema y DAST
```

Dominio de ejemplo: **Biblioteca UC**. Catálogo de libros (SPEC-LIB-01), préstamos (SPEC-LIB-02)
y renovación de préstamos (SPEC-LIB-03, reglas RENEW-R*).

## Backend: capas

```
HTTP ──► presentation ──► application ──► domain
                              │              ▲
                              ▼              │
                        infrastructure ──────┘
```

| Capa             | Carpeta                         | Responsabilidad                                                        | Puede importar               | Tests                                    |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------- | ---------------------------- | ---------------------------------------- |
| `domain`         | `backend/src/<modulo>/domain`         | Entidades, value objects y reglas puras (ISBN, préstamo, políticas)    | nada (solo TypeScript)       | unit, sin mocks                          |
| `application`    | `backend/src/<modulo>/application`    | Casos de uso. Orquesta dominio y puertos (interfaces de repositorio, reloj) | `domain`                     | unit con *fakes* en memoria              |
| `infrastructure` | `backend/src/<modulo>/infrastructure` | Adaptadores: repositorios TypeORM, entidades de persistencia, migraciones | `domain`, `application`      | integración con Testcontainers (PostgreSQL) |
| `presentation`   | `backend/src/<modulo>/presentation`   | Controllers HTTP, DTOs, mapeo de errores a `application/problem+json`  | `application`, `domain`      | contrato con supertest + Testcontainers  |

Reglas (verificadas con dependency-cruiser):

- **ARCH-R1** `domain` no importa `@nestjs/*`, `typeorm`, `pg` ni otras capas.
- **ARCH-R2** `application` no importa `infrastructure` ni `presentation`. Depende de puertos (interfaces).
- **ARCH-R3** `presentation` no importa `infrastructure` (no accede a repositorios directamente).
- **ARCH-R4** No hay dependencias circulares.
- **ARCH-R5** Un módulo no importa la capa interna de otro módulo, salvo su `domain` o `application` público.

Módulos: `books`, `loans`, `health`, `shared` (reloj, errores, configuración).

Cada capa tiene un `SPEC.md` en su carpeta con sus reglas, sus límites y la tabla
"regla → test". Es la spec que se usa para construir esa capa.

## Frontend: capas

```
app (rutas) ──► features/<f>/components ──► features/<f>/hooks ──► shared/api (cliente OpenAPI)
                         │                         │
                         └────────► shared/domain ◄┘   (funciones puras)
```

| Capa                       | Carpeta                                | Responsabilidad                                        | Tests                               |
| -------------------------- | -------------------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `app`                      | `frontend/src/app`                     | Rutas y composición de páginas                         | E2E Playwright                      |
| `features/*/components`    | `frontend/src/features/<f>/components` | UI de cada feature                                     | componentes (Vitest + Testing Library + MSW) |
| `features/*/hooks`         | `frontend/src/features/<f>/hooks`      | Estado y casos de uso de UI, llaman al cliente API     | componentes con MSW                 |
| `shared/api`               | `frontend/src/shared/api`              | Cliente tipado generado desde OpenAPI (`openapi-fetch`) | contrato de mocks                   |
| `shared/domain`            | `frontend/src/shared/domain`           | Funciones puras: formato de fechas, etiquetas y colores de estado, ISBN | unit, sin mocks          |
| `mocks`                    | `frontend/src/mocks`                   | Handlers MSW (mock server) validados contra OpenAPI    | contrato de mocks                   |

Reglas:

- **ARCH-R6** `shared/domain` no importa React, Next ni `shared/api`.
- **ARCH-R7** Los componentes no llaman `fetch` directo. Usan hooks que usan `shared/api`.
- **ARCH-R8** `app` no importa `mocks` (MSW se activa solo por variable de entorno).

## Interfaz de scripts (la usa el pipeline)

Cada app expone estos scripts npm. El pipeline solo llama scripts, nunca comandos sueltos.

| Script               | backend | frontend | Qué hace                                                          |
| -------------------- | :-----: | :------: | ----------------------------------------------------------------- |
| `lint`               | ✔       | ✔        | ESLint                                                            |
| `format:check`       | ✔       | ✔        | Prettier                                                          |
| `typecheck`          | ✔       | ✔        | `tsc --noEmit`                                                    |
| `test:arch`          | ✔       | ✔        | dependency-cruiser                                                |
| `test:unit`          | ✔       | ✔        | Unitarios con cobertura (`reports/`)                              |
| `test:integration`   | ✔       |          | Repositorios y BD con Testcontainers                              |
| `test:contract`      | ✔       | ✔        | Backend: HTTP real vs OpenAPI. Frontend: mocks MSW vs OpenAPI     |
| `test:e2e`           |         | ✔        | Playwright contra Next + MSW (sin backend): flujos, visual, estilos, a11y |
| `test:e2e:smoke`     |         | ✔        | Playwright `@smoke` contra el stack real (`E2E_BASE_URL`)         |
| `test:mutation`      | ✔       | ✔        | Stryker (solo nightly)                                            |
| `api:generate`       |         | ✔        | Regenera tipos desde `specs/api/openapi.yaml`                     |
| `api:check`          |         | ✔        | Falla si los tipos generados no coinciden con el contrato         |
| `build`              | ✔       | ✔        | Build de producción                                               |

## Puertos y variables

| Variable                  | Valor por defecto                                          | Uso                                   |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `PORT` (backend)          | `3001`                                                     | Puerto HTTP de la API (prefijo `/api`) |
| `DATABASE_URL`            | obligatoria, sin valor por defecto (ej. `postgres://usuario:clave@localhost:5432/biblioteca`) | Conexión PostgreSQL |
| `CLOCK_FIXED_NOW`         | sin valor                                                  | Fija el reloj del backend (solo pruebas y evidencia) |
| `BACKEND_URL` (frontend)  | `http://localhost:3001`                                    | Destino del rewrite `/api/*` de Next  |
| `NEXT_PUBLIC_API_MOCKING` | `disabled`                                                 | `enabled` activa MSW en el navegador  |
| `E2E_BASE_URL`            | `http://localhost:3000`                                    | URL que prueba Playwright             |

## Evidencia para el PR (formato acordado)

El frontend escribe `frontend/evidence/manifest.json` después de `test:e2e` o `test:e2e:smoke`:

```json
{
  "target": "mock",
  "items": [
    {
      "id": "FLOW-PRE-01",
      "title": "Pedir prestado un libro disponible",
      "status": "passed",
      "video": "videos/FLOW-PRE-01.webm",
      "screenshots": ["screenshots/FLOW-PRE-01-1-catalogo.png"]
    }
  ]
}
```

El backend escribe `backend/reports/contract-coverage.json` después de `test:contract`:

```json
{
  "operations": [
    { "operationId": "createLoan", "method": "POST", "path": "/api/loans", "statuses": [201, 400, 404, 409], "passed": true }
  ]
}
```
