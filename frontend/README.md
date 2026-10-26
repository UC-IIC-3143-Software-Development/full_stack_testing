# Frontend · Biblioteca UC

Next.js 16 (App Router, React 19, TypeScript) con un **mock server (MSW)** que permite probar
todo el frontend sin levantar el backend. Las reglas vienen de `specs/` (Spec Driven Development):
cada test nombra en su título el ID de la regla o del flujo que verifica.

## Cómo correrlo

```bash
npm ci
npm run dev:mock        # http://localhost:3000 con la API simulada (no necesita backend)
npm run dev             # http://localhost:3000 contra el backend real en BACKEND_URL (por defecto :3001)
```

| Página          | Qué hace                                                             | Reglas                                       |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| `/`             | Catálogo: buscador y grilla de libros con insignia de disponibilidad | UI-CAT-1 a UI-CAT-4                          |
| `/libros/nuevo` | Agregar libro. Valida el ISBN en el navegador                        | UI-CAT-5                                     |
| `/libros/[id]`  | Detalle y formulario "Pedir prestado"                                | UI-LOAN-1, UI-LOAN-4                         |
| `/prestamos`    | "Mis préstamos": busca por correo y permite devolver y renovar       | UI-LOAN-2, UI-LOAN-3, UI-RENEW-1, UI-RENEW-2 |

## Capas

```
app (rutas) ──► features/<f>/components ──► features/<f>/hooks ──► shared/api (cliente OpenAPI)
                         │                         │
                         └────────► shared/domain ◄┘   (funciones puras)

providers/ApiMockingProvider ──(import dinámico, solo si NEXT_PUBLIC_API_MOCKING=enabled)──► mocks
```

| Carpeta                | Responsabilidad                                    | Spec de la capa                |
| ---------------------- | -------------------------------------------------- | ------------------------------ |
| `src/app`              | Rutas y composición de páginas                     | `specs/architecture.md`        |
| `src/features/catalog` | Catálogo: componentes y hooks                      | `src/features/catalog/SPEC.md` |
| `src/features/loans`   | Préstamos: componentes y hooks                     | `src/features/loans/SPEC.md`   |
| `src/shared/api`       | Cliente tipado (`openapi-fetch`) y tipos generados | `specs/api/openapi.yaml`       |
| `src/shared/domain`    | ISBN, estado de préstamo, formato de fechas        | `src/shared/domain/SPEC.md`    |
| `src/mocks`            | Mock server MSW validado contra el contrato        | `src/mocks/SPEC.md`            |

Las reglas de dependencia (ARCH-R4, ARCH-R6, ARCH-R7, ARCH-R8) las verifica `npm run test:arch`
con dependency-cruiser. ESLint además prohíbe `fetch` directo en componentes y rutas.

### Contrato OpenAPI y tipos

`src/shared/api/schema.d.ts` se genera desde `../specs/api/openapi.yaml` y **se commitea**.

```bash
npm run api:generate    # regenera los tipos después de cambiar el contrato
npm run api:check       # falla si el contrato y los tipos commiteados no coinciden (drift check)
```

## Mock server: por qué no hace falta el backend

MSW intercepta las solicitudes **a nivel de red**: el código de la app hace `fetch` igual que en
producción y no sabe que la respuesta es simulada. Los mismos handlers (`src/mocks/handlers.ts`) se usan en:

| Dónde         | Cómo                                           | Para qué                           |
| ------------- | ---------------------------------------------- | ---------------------------------- |
| Vitest (Node) | `setupServer` en `src/mocks/node.ts`           | Tests de componentes sin `vi.mock` |
| Navegador     | Service Worker (`public/mockServiceWorker.js`) | Playwright y `npm run dev:mock`    |

La "base de datos" del mock es un fake en memoria sembrado con los libros de `specs/flows/README.md`.
En el navegador vive en `sessionStorage`: sobrevive a un `page.goto()` y cada test de Playwright parte limpio.

¿Y si el mock miente? `npm run test:contract` valida **cada respuesta** del mock (éxitos y errores)
contra el schema, el status y el media type del contrato con Ajv. Es el lado consumidor del contrato
bidireccional. El backend valida el lado proveedor con supertest y Testcontainers.

El build de producción no incluye MSW: `NEXT_PUBLIC_API_MOCKING` vale `disabled` por defecto, Next
elimina esa rama al compilar y el Dockerfile borra el Service Worker.

## Tipos de test

| Script                | Tipo                       | Qué verifica                                                             | Dónde                                 |
| --------------------- | -------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| `test:unit`           | Unit sin dobles            | Funciones puras del dominio (BOOK-R1, LOAN-R6, UI-LOAN-1)                | `src/shared/domain/*.test.ts`         |
| `test:unit`           | Componentes                | Comportamiento visible con Testing Library y MSW                         | `src/features/**/*.test.tsx`          |
| `test:contract`       | Contrato de mocks          | Respuestas MSW vs `openapi.yaml` (MOCK-R1, MOCK-R2)                      | `src/mocks/handlers.contract.test.ts` |
| `test:e2e` (`flows`)  | Flujos BDD desde la spec   | Los escenarios de `specs/flows/*.feature`, con video y capturas          | `tests/e2e/steps/`                    |
| `test:e2e` (`visual`) | Regresión visual           | Capturas comparadas con imágenes de referencia de Linux                  | `tests/visual/`                       |
| `test:e2e` (`style`)  | Estilos computados         | Colores exactos de los tokens (`toHaveCSS`)                              | `tests/style/`                        |
| `test:e2e` (`layout`) | Posiciones relativas       | Grilla de 3 y 1 columnas, insignia arriba a la derecha (`boundingBox`)   | `tests/layout/`                       |
| `test:e2e` (`a11y`)   | Accesibilidad              | Cero violaciones WCAG A/AA con axe-core                                  | `tests/a11y/`                         |
| `test:e2e:smoke`      | Smoke contra el stack real | Escenarios `@smoke` contra frontend, backend y PostgreSQL                | `E2E_BASE_URL`                        |
| `test:lighthouse`     | Lighthouse CI              | Accesibilidad ≥ 0,95 y buenas prácticas ≥ 0,9 (rendimiento y SEO avisan) | `lighthouserc.json`                   |
| `test:mutation`       | Mutation testing           | Calidad de los tests del dominio (Stryker, solo nightly)                 | `stryker.config.mjs`                  |
| `test:arch`           | Arquitectura               | Reglas de dependencia entre capas                                        | `.dependency-cruiser.cjs`             |

¿Por qué tres tipos de test "visuales"? Porque fallan por razones distintas:

- **style**: detecta un cambio de color de forma determinista. Corre igual en cualquier sistema operativo.
- **layout**: detecta que algo cambió de posición, comparando cajas entre sí y no píxeles.
- **visual**: detecta todo lo demás (márgenes, tipografía, íconos), pero solo es confiable en el
  mismo sistema operativo y con las mismas fuentes. Por eso sus imágenes se generan en Docker.

### Flujos: la spec es el test

`specs/flows/*.feature` está escrito en Gherkin en español. `npx bddgen` (playwright-bdd) lo convierte
en tests de Playwright usando los pasos de `tests/e2e/steps/` (una sola implementación por paso).
Escribir un escenario nuevo con pasos existentes **no requiere código**.

Cada escenario graba un video (960x600) y una captura después de cada paso en
`evidence/screenshots/<FLOW-ID>-<n>-<paso>.png`. Al final, `scripts/collect-evidence.mjs` escribe
`evidence/manifest.json` (formato de `specs/architecture.md`) y el pipeline lo publica en el PR.

Todos los tests de navegador usan `locale` es-CL, zona `America/Santiago` y el reloj fijo
`2026-03-02T12:00:00Z` (`tests/support/clock.ts`). Por eso la fecha de devolución siempre es `16-03-2026`
y, después de renovar (FLOW-PRE-04), `23-03-2026`.

### Smoke contra el stack real

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e:smoke
```

No levanta servidor. Un `globalSetup` siembra por la API los libros de las fixtures (si no existen),
deja Ficciones con 1 copia disponible y La casa de los espíritus agotado (con préstamos de
`carla@uc.cl`) y devuelve los préstamos que `ana@uc.cl` dejó de otra corrida.
El backend debe correr con `CLOCK_FIXED_NOW=2026-03-02T12:00:00Z` para que coincida la fecha.

### Líneas base de la regresión visual

Las imágenes de `tests/visual/__screenshots__/` se generan en Linux, dentro de la imagen oficial de
Playwright (la misma del job de CI). En macOS y Windows esos tests se omiten (`ignoreSnapshots`).

```bash
npm run test:visual:docker               # regenera las líneas base
npm run test:visual:docker -- --check    # compara sin regenerar
npm run test:visual:docker -- --e2e      # corre test:e2e completo en Linux
```

Si un cambio visual es intencional, regenera, revisa las imágenes en el diff del PR y commitea.

## Política de tests (cómo evitamos miles de tests inútiles)

La constitución (`specs/constitution.md`, P4) se verifica con herramientas, no con buena voluntad:

- ESLint rechaza tests sin ID de regla en el título, `vi.fn`, `vi.mock`, `vi.spyOn`, `toBeTruthy`,
  `toBeDefined` y `waitForTimeout`.
- Máximo 6 tests por regla y capa: particiones de equivalencia y valores límite, no variantes del mismo caso.
- Cada test vive en la capa más baja que detecta el defecto. Por ejemplo, la validación del ISBN se
  prueba en `isbn.test.ts` y el flujo E2E solo verifica que el error se muestre.
- Stryker mide si los tests detectan cambios reales en el código. En este proyecto encontró que los
  dos ISBN válidos de ejemplo no distinguían el orden de los pesos 1 y 3, y se agregó un caso.

## Docker

```bash
# Desde la raíz del repo (el contexto es el monorepo)
docker build -f frontend/Dockerfile -t biblioteca-frontend .
docker build -f frontend/Dockerfile --build-arg BACKEND_URL=http://api:3001 -t biblioteca-frontend .
```

Multi-stage con `node:24-alpine`, salida `standalone`, usuario sin privilegios, `HEALTHCHECK` y sin
el Service Worker de MSW. `BACKEND_URL` es un ARG porque Next graba los rewrites en el build.

## Variables

| Variable                  | Por defecto             | Uso                                        |
| ------------------------- | ----------------------- | ------------------------------------------ |
| `BACKEND_URL`             | `http://localhost:3001` | Destino del rewrite `/api/*` (en el build) |
| `NEXT_PUBLIC_API_MOCKING` | `disabled`              | `enabled` activa MSW en el navegador       |
| `E2E_BASE_URL`            | sin valor               | Si existe, Playwright no levanta servidor  |
| `E2E_TARGET`              | `mock` o `fullstack`    | Se anota en `evidence/manifest.json`       |
| `E2E_PORT`                | `3000`                  | Puerto del servidor que levanta Playwright |
