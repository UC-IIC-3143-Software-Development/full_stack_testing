# Full Stack Testing con IA y DevSecOps

Proyecto de ejemplo de la clase de **IIC3143 Desarrollo de Software** (UC). Es un monorepo
con una app pequeña, la **Biblioteca UC** (catálogo de libros, préstamos y renovación), construida con
**Spec Driven Development** y probada en todas sus capas por un pipeline de CI con
seguridad integrada. Está basado en *Full Stack Testing* (Gayathri Mohan, 2.ª ed.,
O'Reilly 2026).

La pregunta que guía el proyecto: **¿cómo aprovechar la IA para escribir y revisar
tests sin terminar con miles de tests que no valen la pena?** La respuesta tiene tres
partes: specs con reglas identificadas, una política de tests explícita (constitución P4)
y un pipeline que la hace cumplir.

- Pipeline explicado etapa por etapa: [`docs/pipeline.md`](docs/pipeline.md)
- Ejemplo del comentario de evidencia en un PR: [`docs/ejemplo-comentario-pr.md`](docs/ejemplo-comentario-pr.md)

## Mapa del monorepo

```
full_stack_testing/
├── specs/                     FUENTE DE VERDAD
│   ├── constitution.md        principios no negociables (P4: política de tests)
│   ├── architecture.md        capas, reglas ARCH-R*, scripts, puertos, formato de evidencia
│   ├── api/openapi.yaml       contrato de la API (OpenAPI 3.1)
│   ├── features/              SPEC-LIB-01 catálogo, SPEC-LIB-02 préstamos, SPEC-LIB-03 renovación
│   │                          (reglas BOOK-R*, LOAN-R*, RENEW-R*, UI-*)
│   ├── flows/*.feature        flujos de usuario en Gherkin (se ejecutan con playwright-bdd)
│   └── templates/             plantillas para specs de feature y de capa
├── backend/                   NestJS + PostgreSQL (TypeORM), capas domain, application,
│                              infrastructure y presentation, cada una con su SPEC.md
├── frontend/                  Next.js (App Router) + MSW como mock server
├── tools/                     herramientas del pipeline
│   ├── spec-trace.mjs         trazabilidad spec a tests y presupuesto por regla y capa
│   ├── api-smoke.mjs          smoke de todos los endpoints contra el stack real
│   ├── seed-stack.mjs         siembra los datos de prueba por la API pública
│   ├── evidence/              GIF, publicación en la rama evidence y comentario del PR
│   ├── perf/k6-smoke.js       prueba de humo de rendimiento
│   └── zap/                   reglas de OWASP ZAP y compuerta de alertas
├── .github/workflows/         ci.yml, nightly.yml, ai-review.yml, ai-generate-tests.yml,
│                              visual-baselines.yml
├── .semgrep/                  reglas Semgrep propias ligadas a las specs (con sus tests)
├── .githooks/pre-commit       gitleaks + Prettier antes de cada commit
├── .spectral.yaml             reglas de estilo del contrato
├── .gitleaks.toml             configuración de detección de secretos
├── .hadolint.yaml             configuración del lint de Dockerfiles
├── docker-compose.yml         stack completo: PostgreSQL, backend y frontend
└── docs/                      pipeline explicado y ejemplo del comentario de evidencia
```

## Configuración inicial del repositorio

Algunas compuertas dependen de opciones de GitHub que no se versionan en el repo. Al crear tu
copia, revisa en **Settings**:

1. **Security (Advanced Security), Dependency graph**: actívalo para que dependency review
   (etapa 4) bloquee el PR. Sin Dependency graph el paso no puede correr y hoy es informativo:
   deja un aviso en el resumen del job y npm audit y Trivy fs siguen bloqueando.
2. **Rules o Branches**: protege `main` y exige el check "Resultado del pipeline", que falla si
   alguna etapa falló.
3. **Secrets and variables, Actions**: el secreto `ANTHROPIC_API_KEY` para la revisión con IA
   (ver [Revisión de código con IA](#revisión-de-código-con-ia)).

## Cómo correrlo

Requisitos: Node 24 (`.nvmrc`), Docker y npm.

### Todo junto con Docker Compose

```bash
docker compose up -d --build --wait      # PostgreSQL, backend (3001) y frontend (3000)
npm ci && npm run seed:stack             # datos de prueba de specs/flows/README.md
open http://localhost:3000
docker compose down -v                   # baja todo y borra la base de datos
```

Si esos puertos están ocupados, cámbialos con variables:
`BACKEND_PORT=3101 FRONTEND_PORT=3100 DB_PORT=55432 docker compose up -d --build --wait`.
Para fijar el reloj del backend (fechas de devolución reproducibles):
`CLOCK_FIXED_NOW=2026-03-02T12:00:00Z docker compose up -d --wait`.

### Cada app por separado

```bash
# Backend: necesita PostgreSQL (docker compose up -d db)
cd backend && npm ci && npm run start:dev

# Frontend con mock server: NO necesita backend
cd frontend && npm ci && npm run dev:mock

# Frontend contra el backend real (rewrite de /api a BACKEND_URL)
cd frontend && npm run dev
```

### Herramientas de la raíz

```bash
npm ci
npm run lint:openapi        # Spectral sobre specs/api/openapi.yaml
npm run spec:trace          # cada regla con tests, sin huérfanos, máximo 6 por regla y capa
npm run test:tools          # tests de tools/
npm run evidence:example    # regenera docs/ejemplo-comentario-pr.md
npm run hooks:install       # activa .githooks/pre-commit (git config core.hooksPath .githooks)
```

## Flujo de Spec Driven Development

```
 1. Spec de feature     specs/features/SPEC-LIB-02-prestamos.md    reglas con ID: LOAN-R2
 2. Contrato            specs/api/openapi.yaml                     Spectral y oasdiff en CI
 3. Flujos de usuario   specs/flows/prestamos.feature              @FLOW-PRE-03, son tests
 4. Spec de cada capa   backend/src/loans/domain/SPEC.md           qué vive en esa capa
 5. Tests que fallan    it('[LOAN-R2] rechaza un cuarto préstamo') spec-trace los cruza
 6. Código              hasta que todo queda verde
 7. PR                  el pipeline publica la evidencia y la IA revisa contra las specs
```

Cada test nombra la regla que verifica al inicio de su título. Así `tools/spec-trace.mjs`
puede responder en CI: ¿qué regla no tiene tests?, ¿qué test no verifica ninguna regla
(huérfano)?, ¿qué regla tiene más tests de los que necesita? Ese presupuesto (6 por regla
y capa, constitución P4.2) es la baranda que evita que un agente de IA genere cientos de
variantes del mismo caso.

## Tipos de prueba

| Tipo | Qué verifica | Herramienta | Dónde | Etapa | Libro |
| --- | --- | --- | --- | :---: | --- |
| Unitario de dominio | Reglas de negocio puras (ISBN, préstamo, estado) sin mocks | Jest | `backend/src/*/domain/*.spec.ts` | 5 | p. 67 y 103 |
| Unitario de aplicación | Casos de uso con repositorios en memoria y fecha fija de prueba | Jest + fakes | `backend/src/*/application/*.spec.ts` | 5 | p. 103 |
| Integración con base real | Repositorios TypeORM, índice único, `CHECK`, concurrencia | Testcontainers (PostgreSQL) | `backend/src/*/infrastructure/*.int-spec.ts` | 6 | p. 179 |
| Contrato de la API | Respuesta HTTP real (controller a base de datos) contra el OpenAPI | supertest + Testcontainers | `backend/test/contract/` | 6 | p. 70 y 107 |
| Unitario de frontend | Funciones puras: ISBN, fechas `dd-mm-aaaa`, etiquetas de estado | Vitest | `frontend/src/shared/domain/` | 5 | p. 188 |
| Componentes | Render e interacción con la API simulada | Vitest + Testing Library + MSW | `frontend/src/features/*/components/` | 5 | p. 189 |
| Contrato de mocks | Los handlers de MSW cumplen el OpenAPI | Vitest + Ajv | `frontend/src/mocks/` | 5 | p. 107 |
| Flujos E2E (BDD) | Escenarios Gherkin de `specs/flows/` contra Next + MSW, sin backend | Playwright + playwright-bdd | `frontend/tests/e2e/steps/` | 7 | p. 87 y 191 |
| Regresión visual | La pantalla se ve igual que la referencia aprobada | Playwright `toHaveScreenshot` | `frontend/tests/visual/` | 7 | p. 191 y 195 |
| Estilos | La insignia es verde `#1E7F3C` o roja `#B42318` según la spec | Playwright `toHaveCSS` | `frontend/tests/style/` | 7 | p. 185 |
| Layout | Grilla de 3 columnas en escritorio, 1 en móvil, insignia arriba a la derecha | Playwright + `boundingBox` | `frontend/tests/layout/` | 7 | p. 185 |
| Accesibilidad | Reglas WCAG automatizables | axe-core con Playwright | `frontend/tests/a11y/` | 7 | p. 297 |
| Arquitectura | Las capas respetan sus dependencias (ARCH-R1 a ARCH-R8) | dependency-cruiser | `npm run test:arch` | 2 | p. 315 |
| Lint del contrato | El OpenAPI está completo y no rompe clientes | Spectral, oasdiff | `.spectral.yaml` | 2 | p. 70 |
| Trazabilidad | Reglas con tests, sin huérfanos, dentro del presupuesto | `tools/spec-trace.mjs` | `tools/` | 2 | p. 72 y 114 |
| Secretos | Credenciales en el código o el historial | gitleaks (hook y CI) | `.githooks/`, `.gitleaks.toml` | 1 | p. 238 |
| SAST | Código vulnerable y violaciones de las specs | Semgrep, CodeQL | `.semgrep/` | 3 | p. 225 |
| SCA | Dependencias con vulnerabilidades conocidas | dependency review, npm audit, Trivy fs | `ci.yml` | 4 | p. 216 y 226 |
| Contenedores y SBOM | Vulnerabilidades de la imagen e inventario de componentes | Trivy image, CycloneDX | `ci.yml` | 8 | p. 226 |
| Smoke E2E del sistema | Los flujos `@smoke` contra el stack real con PostgreSQL | Playwright | `specs/flows/*.feature` | 9 | p. 128 |
| Smoke de la API | Todos los endpoints del contrato responden en el stack real | `tools/api-smoke.mjs` | `tools/` | 9 | p. 128 |
| Fuzzing desde el contrato | Miles de requests generadas desde el OpenAPI buscando respuestas fuera del contrato | Schemathesis | `specs/api/openapi.yaml` | 9 | complementa p. 107 |
| Rendimiento | p95 menor a 500 ms y menos de 1 % de errores | k6 | `tools/perf/k6-smoke.js` | 9 | p. 245 y 250 |
| Calidad web | Rendimiento, accesibilidad, buenas prácticas y SEO | Lighthouse CI | `frontend/lighthouserc.json` | 9 | p. 270 y 295 |
| DAST | Ataques a la app corriendo (cabeceras, inyección, XSS) | OWASP ZAP | `tools/zap/` | 9 | p. 227 y 229 |
| Mutation testing | Tests que no detectan cambios en el código | Stryker | `nightly.yml` | noche | p. 116 |
| Cross-browser | Los flujos en Firefox y WebKit | Playwright | `nightly.yml` | noche | p. 192 |
| Revisión con IA | El diff respeta specs, capas y política de tests | Claude (claude-code-action) | `ai-review.yml` | PR | p. 139 |
| Propuesta de tests con IA | Plan de casos y tests de contrato para una operación | Claude (claude-code-action) | `ai-generate-tests.yml` | manual | p. 139 a 143 |

**Mock server sin backend.** El frontend se prueba completo (componentes y E2E) con MSW,
que intercepta las llamadas a `/api` en el navegador y en Node. Los handlers se validan
contra el mismo OpenAPI que implementa el backend, así que el mock no puede mentir sobre
el contrato. Por eso la etapa 7 no necesita levantar ni el backend ni la base de datos.

## Capturas de referencia visuales

Los tests visuales comparan cada pantalla con una captura aprobada
(`frontend/tests/visual/__screenshots__/`). Una captura depende del sistema operativo, de las
fuentes y del navegador, así que **nunca se genera en el computador de cada persona**: se genera
en la misma imagen Docker de Playwright que usa la etapa 7 del CI, con el workflow
[`visual-baselines.yml`](.github/workflows/visual-baselines.yml).

- Si las capturas no existen, el workflow las crea y las commitea en `main`.
- Si un PR cambia la UI a propósito, ejecuta el workflow a mano (Actions, "Capturas de referencia
  visuales", Run workflow) sobre la rama del PR. El bot commitea las capturas nuevas y la persona
  que revisa el PR aprueba el cambio visual junto con el código.
- **Ojo: el commit del bot no dispara el CI.** Lo hace con `GITHUB_TOKEN` y GitHub no dispara otros
  workflows con ese token, así que `ci.yml` no corre sobre ese commit y el PR queda sin el check
  "Resultado del pipeline". Después del commit del bot, haz un push a la rama (por ejemplo
  `git commit --allow-empty -m "ci: correr el pipeline"`) para que el CI corra sobre el último commit.
- Localmente (macOS o Windows) los tests visuales se omiten. Para verlos en Linux usa
  `npm run test:visual:docker` en `frontend/`.

## Cómo leer la evidencia del PR

En cada PR la etapa 10 deja (y actualiza en cada push) un comentario con:

1. **Estado global y tabla de etapas DevSecOps**, con un ✅ o ❌ por job.
2. **Frontend**: por cada flujo de `specs/flows/`, el GIF de la prueba real y miniaturas
   de las capturas de cada paso. Primero contra el mock server y después contra el stack
   real.
3. **Backend**: por cada operación del OpenAPI, los códigos verificados por los tests de
   contrato y por el smoke contra el stack real, con su tiempo. Abajo, el resultado de
   Schemathesis.
4. **Seguridad y calidad**: gitleaks, Semgrep, CodeQL, dependencias, Trivy (por
   severidad), ZAP (por riesgo), Lighthouse, k6 y trazabilidad.

Las imágenes viven en la rama huérfana `evidence` (`pr-<número>/<run_id>/`) y los
reportes completos (HTML de Playwright, ZAP y Lighthouse, SBOM) quedan como artefactos
del run. Mira el ejemplo en [`docs/ejemplo-comentario-pr.md`](docs/ejemplo-comentario-pr.md).

## Revisión de código con IA

`ai-review.yml` le pide a Claude que revise cada PR contra `specs/constitution.md`,
`specs/architecture.md`, las specs de features y los `SPEC.md` de las capas tocadas:
reglas implementadas como dice la spec, imports que cruzan capas, tests huérfanos,
mocks injustificados, tests duplicados entre capas, aserciones débiles y riesgos OWASP.
Deja comentarios en línea y un resumen con veredicto.

Para activarla:

1. En GitHub: **Settings, Secrets and variables, Actions, New repository secret**.
2. Nombre `ANTHROPIC_API_KEY`, valor tu API key de Anthropic.
3. Para `ai-generate-tests.yml`, además: **Settings, Actions, General**, activa
   "Allow GitHub Actions to create and approve pull requests".

Sin el secreto, los dos workflows terminan en verde con un aviso en el resumen del run.
Los PR desde forks no reciben secretos, así que tampoco ejecutan la revisión.

## Seguridad en el repositorio

- `git config core.hooksPath .githooks` activa el hook que corre gitleaks y Prettier
  antes de cada commit (inspirado en Talisman, libro p. 238).
- Todas las acciones de GitHub están fijadas por SHA, cada job tiene permisos mínimos y
  zizmor revisa los workflows en cada PR. Detalle en [`docs/pipeline.md`](docs/pipeline.md).
- Dependabot actualiza npm, acciones y Docker con 7 días de espera para no adoptar una
  versión el mismo día que sale.
- Las imágenes corren con un usuario sin privilegios y Trivy las escanea antes de probarlas.

## Licencia

MIT. Material docente de IIC3143, Pontificia Universidad Católica de Chile.
