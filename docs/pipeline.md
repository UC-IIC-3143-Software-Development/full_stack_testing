# Pipeline de CI con DevSecOps

Este documento explica el pipeline de `.github/workflows/ci.yml`: qué corre en cada
etapa, qué detecta cada herramienta, por qué está en ese lugar y dónde aparece en el
libro *Full Stack Testing* (Gayathri Mohan, 2.ª ed., O'Reilly 2026).

Solo hay **integración continua** (CI). No hay despliegue continuo (CD): el pipeline
termina cuando el PR tiene toda la evidencia para decidir si se integra a `main`.

## Idea central: dos ciclos de feedback

El libro propone separar las pruebas en dos ciclos (cap. 4, p. 126 a 128):

1. **Ciclo rápido** sobre el código estático: lint, tipos, seguridad estática y tests
   que no necesitan desplegar nada (unitarios, integración con contenedores, E2E con
   mock server). Debe tardar "lo que tarda una taza de té".
2. **Ciclo lento** sobre la aplicación construida y corriendo: pruebas de sistema,
   DAST, rendimiento y accesibilidad contra el stack real.

El ciclo lento espera a que pase toda la calidad de la etapa 2 (lint, tipos, arquitectura,
contrato, trazabilidad y lint de infraestructura) y los unitarios de la etapa 5: no tiene
sentido construir y atacar una imagen cuyo código no compila, rompe el contrato o no pasa los
unitarios. El resto del ciclo rápido (secretos, SAST, dependencias, integración y E2E con mock
server) corre en paralelo con el ciclo lento y bloquea el PR en el check "Resultado del pipeline".

```
 PR abierto o push
        │
        ▼
 ┌──────────────┐
 │ 0 · Cambios  │  ¿qué carpetas tocó el PR? (dorny/paths-filter)
 └──────┬───────┘
        │      CICLO RÁPIDO: corren en paralelo, sin desplegar nada
        ├──────────────────────────────────────────────────────────────────┐
        │  1 · Secretos ............ gitleaks sobre todo el historial      │
        │  2 · Calidad y spec ...... ESLint, Prettier, tsc, dependency-     │
        │                            cruiser, Spectral, oasdiff, api:check, │
        │                            spec-trace, hadolint, actionlint,      │
        │                            zizmor                                 │
        │  3 · SAST ................ Semgrep (registro + .semgrep/), CodeQL │
        │  4 · Dependencias (SCA) .. dependency review, npm audit, Trivy fs │
        │  5 · Unitarios ........... Jest (backend), Vitest + MSW (frontend)│
        │  6 · Integración backend . Testcontainers + supertest vs OpenAPI  │
        │  7 · E2E con mock server . Playwright + MSW (sin backend)         │
        ├──────────────────────────────────────────────────────────────────┘
        │      CICLO LENTO: necesita toda la etapa 2 y la 5 en verde
        ▼
 ┌────────────────────────────┐     ┌──────────────────────────────────────┐
 │ 8 · Build e imágenes       │────►│ 9 · Sistema                          │
 │   docker compose build     │     │   seed, Playwright @smoke, smoke de  │
 │   Trivy image, SBOM        │     │   la API, Schemathesis, k6,          │
 │   docker save (artefacto)  │     │   Lighthouse CI                      │
 └────────────────────────────┘     ├──────────────────────────────────────┤
                                    │ 9 · DAST                             │
                                    │   ZAP baseline (frontend)            │
                                    │   ZAP API scan con el OpenAPI        │
                                    └──────────────────┬───────────────────┘
                                                       ▼
                                    ┌──────────────────────────────────────┐
                                    │ 10 · Evidencia en el PR              │
                                    │   GIF, capturas, endpoints, hallazgos│
                                    │ Resultado del pipeline (check único) │
                                    └──────────────────────────────────────┘
```

**Construye una vez, prueba ese mismo artefacto.** La etapa 8 construye las imágenes
y las guarda como artefacto (`docker save`). La etapa 9 las carga con `docker load`
y levanta el stack con `docker compose up --no-build`: lo que se escanea con Trivy es
exactamente lo que se prueba con Playwright y se ataca con ZAP.

## Etapas en detalle

| Etapa | Job | Herramientas | Qué detecta | Falla si | Libro |
| --- | --- | --- | --- | --- | --- |
| 0 | `cambios` | dorny/paths-filter | Qué apps tocó el PR | nunca | cap. 4 |
| 1 | `secretos` | gitleaks (CLI en Docker) | Llaves, tokens y contraseñas en cualquier commit | hay un hallazgo | p. 226 y 238 |
| 2 | `calidad-backend`, `calidad-frontend` | ESLint, Prettier, `tsc`, dependency-cruiser | Errores de estilo y tipos, imports que rompen las capas (ARCH-R1 a ARCH-R8) | cualquier error | p. 315 a 317 |
| 2 | `contrato-openapi` | Spectral, oasdiff | Contrato incompleto o inconsistente, cambios que rompen clientes | error de Spectral o cambio breaking | p. 70 y 107 |
| 2 | `trazabilidad` | `tools/spec-trace.mjs`, tests de tools | Reglas sin tests, tests huérfanos, IDs inexistentes, más de 6 tests por regla y capa | cualquiera de esos casos | p. 72 y 114 |
| 2 | `lint-infra` | hadolint, actionlint (con shellcheck), zizmor | Dockerfiles inseguros, workflows con errores o inyección de comandos | advertencia o hallazgo | p. 317 |
| 3 | `semgrep` | Semgrep `p/default`, `p/typescript`, `p/nodejs`, `p/owasp-top-ten` y `.semgrep/rules.yml` | Patrones vulnerables y violaciones de nuestras specs (reloj, SQL, fetch, XSS, console.log) | hallazgo de severidad ERROR | p. 225 |
| 3 | `codeql` | CodeQL `security-extended` | Flujos de datos peligrosos (de la entrada a una consulta, por ejemplo) | nunca: es informativo y deja los hallazgos en la pestaña Security | p. 225 |
| 4 | `dependencias` | dependency review, `npm audit --omit=dev` | Dependencias nuevas o actuales con vulnerabilidades conocidas | npm audit con severidad high o mayor. Dependency review es informativo hasta activar Dependency graph en el repo | p. 216 y 226 |
| 4 | `trivy-fs` | Trivy fs | Vulnerabilidades en lockfiles, secretos y misconfiguraciones | secreto o CRITICAL con parche | p. 226 |
| 5 | `unit-backend`, `unit-frontend` | Jest, Vitest, Testing Library, MSW | Reglas de negocio y componentes, sin mocks (fakes en memoria) | un test falla | p. 67 y 103 |
| 6 | `integracion-backend` | Jest + Testcontainers (PostgreSQL) + supertest | Repositorios contra una base real, respuestas HTTP reales contra el OpenAPI | un test falla | p. 179 |
| 7 | `e2e-frontend` | Playwright + playwright-bdd + MSW | Flujos de usuario, regresión visual, colores, posición, accesibilidad | un test falla | p. 183 a 195 |
| 8 | `imagenes` | Docker Compose, Trivy image, CycloneDX | Vulnerabilidades y secretos dentro de la imagen, SBOM | secreto o CRITICAL con parche | p. 226 |
| 9 | `sistema` | seed, Playwright `@smoke`, `tools/api-smoke.mjs`, Schemathesis, k6, Lighthouse CI | El sistema completo responde, el backend cumple el contrato con datos generados, rendimiento y calidad web | un test falla o no se cumplen los umbrales | p. 128, 250 y 270 |
| 9 | `dast` | OWASP ZAP baseline y API scan | Cabeceras faltantes, inyección, XSS en la app corriendo | alerta High o regla FAIL | p. 227 y 229 |
| 10 | `evidencia` | `tools/evidence/*` | Nada: resume todo en el PR | nunca bloquea | p. 121 |

## Glosario DevSecOps (para la diapositiva)

| Sigla | Qué es | Cuándo mira | Ejemplo en este repo |
| --- | --- | --- | --- |
| **Secretos** | Busca credenciales en el código y en el historial de git | antes del commit (hook) y en cada PR | gitleaks, Trivy secret |
| **SAST** | *Static Application Security Testing*: analiza el código fuente sin ejecutarlo | en cada PR | Semgrep, CodeQL |
| **SCA** | *Software Composition Analysis*: vulnerabilidades y licencias de las dependencias | en cada PR y con Dependabot | dependency review, npm audit, Trivy fs |
| **IaC y pipeline** | Revisa la infraestructura como código y los propios workflows | en cada PR | hadolint, Trivy misconfig, actionlint, zizmor |
| **Contenedores** | Vulnerabilidades del sistema operativo y librerías dentro de la imagen | después del build | Trivy image |
| **SBOM** | *Software Bill of Materials*: inventario de todo lo que trae la imagen | después del build | CycloneDX con Trivy |
| **DAST** | *Dynamic Application Security Testing*: ataca la app corriendo, como caja negra | con el stack levantado | OWASP ZAP |
| **Fuzzing de API** | Genera miles de requests desde el contrato buscando respuestas que no cumplen | con el stack levantado | Schemathesis |

```
          SHIFT LEFT: mientras más a la izquierda, más barato corregir
 ◄──────────────────────────────────────────────────────────────────────────
  editor y      pre-commit      PR (ciclo rápido)        PR (ciclo lento)
  agente IA     .githooks/      secretos, SAST, SCA,     imagen, sistema,
  (CLAUDE.md)   gitleaks,       lint, unit, contrato,    DAST, rendimiento
                Prettier        E2E con mocks
```

## Compuertas y umbrales

Una compuerta es una condición explícita, versionada en el repo, que decide si el PR
puede seguir. Ninguna depende del criterio de quien mira el log.

| Compuerta | Umbral | Dónde se cambia |
| --- | --- | --- |
| Semgrep | 0 hallazgos ERROR | `.semgrep/rules.yml` y el paso "Compuerta" del job |
| Trivy fs e imagen | 0 secretos, 0 CRITICAL que tengan parche | paso "Compuerta" de cada job |
| dependency review | severidad high (informativo hasta activar Dependency graph en Settings, Security) | `fail-on-severity` |
| npm audit | `--audit-level=high` en producción | job `dependencias` |
| spec-trace | 6 tests por regla y capa como máximo, 0 huérfanos | `--max-per-layer` |
| k6 | p95 menor a 500 ms y menos de 1 % de errores | `tools/perf/k6-smoke.js` |
| Lighthouse | accesibilidad 0,95 y buenas prácticas 0,9 (error), rendimiento y SEO (aviso) | `frontend/lighthouserc.json` |
| ZAP | 0 alertas High no ignoradas, 0 reglas FAIL | `tools/zap/rules.tsv` |
| hadolint | 0 advertencias | `.hadolint.yaml` |

Se bloquea solo lo que tiene parche o es claramente un error. Una vulnerabilidad
CRITICAL sin versión corregida se informa en el PR, pero no detiene al equipo: no hay
nada que el equipo pueda hacer hoy más que documentarla.

## Seguridad del propio pipeline

El pipeline también es código y también se ataca. En marzo de 2025 alguien comprometió
la acción `tj-actions/changed-files` y movió sus tags a un commit que imprimía los
secretos de miles de repositorios en los logs. Por eso:

- **Acciones fijadas por SHA** con el número de versión en un comentario
  (`actions/checkout@3d3c42e... # v7.0.1`). Un tag se puede mover, un SHA no. Dependabot
  actualiza el SHA y el comentario.
- **Permisos mínimos**: `permissions: {}` arriba y cada job pide solo lo suyo. Solo la
  etapa 10 puede escribir en el repo, y solo para la rama `evidence` y el comentario.
- **`persist-credentials: false`** en cada checkout: el token no queda guardado en
  `.git/config` para pasos posteriores.
- **Sin `${{ }}` dentro de `run:`**: los valores del evento pasan por variables de
  entorno para evitar inyección de comandos con títulos de PR maliciosos.
- **Sin `pull_request_target`**: los PR desde forks corren sin secretos y sin permisos
  de escritura. Los pasos que necesitan escribir (SARIF, comentario) se saltan en forks.
- **actionlint** valida la sintaxis y el shell de los workflows y **zizmor** busca
  problemas de seguridad (tags sin fijar, permisos excesivos, inyección).
- La imagen de Playwright va fijada por digest (`@sha256:...`) por la misma razón.

## Cómo se publica la evidencia en el PR

```
 artefactos de las etapas 1 a 9
   evidencia-mock/        manifest.json, videos/*.webm, screenshots/*.png
   evidencia-fullstack/   lo mismo, contra el stack real
   contrato-backend/      contract-coverage.json
   api-smoke/             endpoints.json
   schemathesis/          junit.xml
   semgrep/ trivy-*/ zap/ gitleaks/ lighthouse/ k6/ spec-trace/
            │
            ▼  etapa 10
 1. videos-to-gif.mjs     webm a GIF (8 fps, 640 px, paleta optimizada)
 2. publish-branch.sh     PNG y GIF a la rama huérfana "evidence" en pr-<n>/<run_id>/
 3. build-comment.mjs     arma el markdown con URLs de raw.githubusercontent.com
 4. github-script         crea el comentario o actualiza el que tiene <!-- ci-evidence -->
```

Un ejemplo completo del comentario está en [`ejemplo-comentario-pr.md`](ejemplo-comentario-pr.md)
(se regenera con `npm run evidence:example`).

La rama `evidence` crece con cada run. Conviene borrar de vez en cuando las carpetas de
PR cerrados (por ejemplo con un workflow programado).

## Otros workflows

| Workflow | Cuándo | Qué hace |
| --- | --- | --- |
| `nightly.yml` | todos los días 06:00 UTC y manual | Mutation testing con Stryker (backend y frontend), flujos en Firefox y WebKit, ZAP full scan opcional |
| `ai-review.yml` | en cada PR que no es borrador | Claude revisa el diff contra la constitución, la arquitectura y las specs. Requiere el secreto `ANTHROPIC_API_KEY` |
| `ai-generate-tests.yml` | manual, eligiendo un `operationId` | Claude propone un plan de casos y tests de contrato, y abre un PR en borrador para revisión humana |
| `visual-baselines.yml` | push a `main` que toca `frontend/tests/visual/` y manual | Genera las capturas de referencia en la imagen de Playwright de CI y las commitea en la rama. El commit del bot no dispara `ci.yml`: haz un push después para correr el pipeline |

**¿Por qué mutation testing no corre en cada PR?** Stryker modifica el código (por
ejemplo cambia `>` por `>=`) y ejecuta la suite completa por cada mutante. Con cientos
de mutantes, tarda varias veces lo que tarda la suite normal. El libro lo resume así:
"Mutation testing, though very effective, is time-consuming, so use it wisely" (p. 116).
De noche no retrasa a nadie y su reporte muestra qué tests no verifican lo que creemos.

## Trunk based development vs Git Flow

```
 GIT FLOW: ramas largas, integración tardía
 main     ●───────────────────────────────●──────────────────●   (solo releases)
           \                             / \                /
 release    \                   ●───●───●   \              /
             \                 /             \            /
 develop      ●───●───●───●───●───●───●───────●───●───●──●
                   \         /     \         /
 feature/a          ●───●───●       \       /
 feature/b                           ●───●─●       semanas sin integrar

 TRUNK BASED: ramas cortas, integración diaria a main
 main     ●───●───●───●───●───●───●───●───●───●───●───●   (siempre verde)
           \ /     \ /     \   /   \ /
 ramas      ●       ●       ●─●     ●          menos de 2 días cada una
            PR      PR      PR      PR         cada PR pasa por el pipeline completo
```

| | Git Flow | Trunk based development |
| --- | --- | --- |
| Ramas | `main`, `develop`, `release/*`, `feature/*`, `hotfix/*` | `main` y ramas cortas |
| Vida de una rama | días o semanas | horas, máximo 2 días |
| Integración | al final de la feature, con conflictos grandes | continua, conflictos chicos |
| Funcionalidad a medias | se queda en su rama | se esconde con *feature flags* |
| Rol del pipeline | se corre antes de cada release | es la red de seguridad de cada PR |
| Cuándo conviene | software con versiones instaladas y varias versiones con soporte | servicios web con despliegues frecuentes |

Este repo usa **trunk based development** (constitución P6): ramas cortas, PR con
evidencia y `main` siempre verde. El libro advierte que una rama de feature de larga
vida es un antipatrón (p. 122). Las métricas DORA (p. 144) miden justamente la
frecuencia de despliegue y el tiempo desde el commit hasta producción, y ambas mejoran
cuando se integra en pasos chicos.

## Correr las herramientas en tu máquina

```bash
npm ci                                   # herramientas de la raíz
npm run lint:openapi                     # Spectral sobre el contrato
npm run spec:trace                       # trazabilidad spec a tests
npm run test:tools                       # tests de tools/
git config core.hooksPath .githooks      # activa el hook pre-commit

# Stack completo con fecha fija de prueba, en puertos que no choquen con otros servicios
CLOCK_FIXED_NOW=2026-03-02T12:00:00Z BACKEND_PORT=3101 FRONTEND_PORT=3100 DB_PORT=55432 \
  docker compose up -d --build --wait
BASE_URL=http://localhost:3101 npm run seed:stack
BASE_URL=http://localhost:3101 npm run api:smoke
docker run --rm --network host -v "$PWD:/w" -w /w -e BASE_URL=http://localhost:3101 \
  grafana/k6:2.3.0 run tools/perf/k6-smoke.js
docker compose down -v

# Seguridad
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 git /repo --config /repo/.gitleaks.toml
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.182.1 semgrep scan --config .semgrep/rules.yml
(cd .semgrep && semgrep --test .)        # tests de las reglas propias
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12
pipx run zizmor .github/
```

Si en tu Docker Desktop `--network host` no llega a los puertos de tu máquina, quita esa
opción y usa `http://host.docker.internal:3101` como `BASE_URL` dentro del contenedor.
