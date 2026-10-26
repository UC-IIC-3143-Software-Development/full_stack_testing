# Pipeline de CI con DevSecOps

Este documento explica el pipeline de `.github/workflows/ci.yml`: qué corre en cada
etapa, qué detecta cada herramienta y por qué está en ese lugar.

Solo hay **integración continua** (CI). No hay despliegue continuo (CD): el pipeline
termina cuando el PR tiene toda la evidencia para decidir si se integra a `main`.

## Idea central: dos ciclos de feedback

Las pruebas se separan en dos ciclos:

1. **Ciclo rápido** sobre el código estático: lint, tipos, seguridad estática y tests
   que no necesitan desplegar nada (unitarios, integración con contenedores, E2E con
   mock server). Debe tardar "lo que tarda una taza de té".
2. **Ciclo lento** sobre la aplicación construida y corriendo: pruebas de sistema,
   DAST y rendimiento contra el stack real.

El ciclo lento espera a que pase toda la calidad de la etapa 2 (lint, tipos, arquitectura,
contrato, trazabilidad y lint del pipeline) y los unitarios de la etapa 5: no tiene
sentido construir y atacar una imagen cuyo código no compila, rompe el contrato o no pasa los
unitarios. El resto del ciclo rápido (secretos, SAST, dependencias, SonarQube, integración y E2E con
mock server) corre en paralelo con el ciclo lento y bloquea el PR en el check "Resultado del pipeline".

```
 PR abierto o push
        │
        ▼
 ┌──────────────┐
 │ 0 · Cambios  │  ¿qué carpetas tocó el PR? (dorny/paths-filter)
 └──────┬───────┘
        │      CICLO RÁPIDO: corren en paralelo, sin desplegar nada
        ├───────────────────────────────────────────────────────────────────┐
        │  1 · Secretos ............ gitleaks sobre todo el historial       │
        │  2 · Calidad y spec ...... ESLint, Prettier, tsc, dependency-     │
        │                            cruiser, Spectral, oasdiff, api:check, │
        │                            spec-trace, actionlint, zizmor         │
        │  3 · SAST ................ Semgrep (registro + .semgrep/)         │
        │  4 · Dependencias (SCA) .. Trivy fs (vulnerabilidades y misconfig)│
        │  5 · Unitarios ........... Jest (backend), Vitest + MSW (frontend)│
        │  5 · SonarQube efímero ... calidad, cobertura y quality gate      │
        │  6 · Integración backend . Testcontainers + supertest vs OpenAPI  │
        │  7 · E2E con mock server . Playwright + MSW (sin backend)         │
        ├───────────────────────────────────────────────────────────────────┘
        │      CICLO LENTO: necesita toda la etapa 2 y la 5 en verde
        ▼
 ┌────────────────────────────┐     ┌───────────────────────────────────────┐
 │ 8 · Build e imágenes       │────►│ 9 · Sistema                           │
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

| Etapa | Job | Herramientas | Qué detecta | Falla si |
| --- | --- | --- | --- | --- |
| 0 | `cambios` | dorny/paths-filter | Qué apps tocó el PR | nunca |
| 1 | `secretos` | gitleaks (CLI en Docker) | Llaves, tokens y contraseñas en cualquier commit | hay un hallazgo |
| 2 | `calidad-backend`, `calidad-frontend` | ESLint, Prettier, `tsc`, dependency-cruiser | Errores de estilo y tipos, imports que rompen las capas (ARCH-R1 a ARCH-R8) | cualquier error |
| 2 | `contrato-openapi` | Spectral, oasdiff | Contrato incompleto o inconsistente, cambios que rompen clientes | error de Spectral o cambio breaking |
| 2 | `trazabilidad` | `tools/spec-trace.mjs`, tests de tools | Reglas sin tests, tests huérfanos, IDs inexistentes, más de 6 tests por regla y capa | cualquiera de esos casos |
| 2 | `lint-infra` | actionlint (con shellcheck), zizmor | Workflows con errores, permisos excesivos o inyección de comandos | error o hallazgo |
| 3 | `semgrep` | Semgrep `p/default`, `p/typescript`, `p/nodejs`, `p/owasp-top-ten` y `.semgrep/rules.yml` | Patrones vulnerables y violaciones de nuestras specs (reloj, SQL, fetch, XSS, console.log) | hallazgo de severidad ERROR |
| 4 | `trivy-fs` | Trivy fs (`--scanners vuln,misconfig`) | Dependencias con vulnerabilidades conocidas (lockfiles) y misconfiguraciones de Dockerfiles y `docker-compose.yml` | CRITICAL con parche |
| 5 | `unit-backend`, `unit-frontend` | Jest, Vitest, Testing Library, MSW | Reglas de negocio y componentes, sin mocks (fakes en memoria) | un test falla |
| 5 | `sonarqube` | SonarQube Community en un contenedor temporal, sonar-scanner-cli, `tools/sonarqube/run.mjs` | Bugs, vulnerabilidades, code smells, security hotspots, cobertura y duplicación de todo el repo ([detalle](#sonarqube-efímero-etapa-5)) | la quality gate falla |
| 6 | `integracion-backend` | Jest + Testcontainers (PostgreSQL) + supertest | Repositorios contra una base real, respuestas HTTP reales contra el OpenAPI | un test falla |
| 7 | `e2e-frontend` | Playwright + playwright-bdd + MSW | Flujos de usuario, regresión visual, colores, posición, accesibilidad | un test falla |
| 8 | `imagenes` | Docker Compose, Trivy image (`--scanners vuln`), CycloneDX | Vulnerabilidades dentro de la imagen, SBOM | CRITICAL con parche |
| 9 | `sistema` | seed, Playwright `@smoke`, `tools/api-smoke.mjs`, Schemathesis, k6, Lighthouse CI | El sistema completo responde, el backend cumple el contrato con datos generados, rendimiento y calidad web | un test falla o no se cumplen los umbrales |
| 9 | `dast` | OWASP ZAP baseline y API scan | Cabeceras faltantes, inyección, XSS en la app corriendo | alerta High o regla FAIL |
| 10 | `evidencia` | `tools/evidence/*` | Nada: resume todo en el PR | nunca bloquea |

## Glosario DevSecOps (para la diapositiva)

Hay una sola herramienta por tipo de análisis: dos herramientas que revisan lo mismo duplican
hallazgos y minutos de CI sin encontrar más problemas.

| Sigla | Qué es | Cuándo mira | Ejemplo en este repo |
| --- | --- | --- | --- |
| **Secretos** | Busca credenciales en el código y en el historial de git | antes del commit (hook) y en cada PR | gitleaks |
| **SAST** | *Static Application Security Testing*: analiza el código fuente sin ejecutarlo | en cada PR | Semgrep |
| **Calidad de código** | Bugs, code smells, duplicación y cobertura de todo el repo, con una quality gate que aprueba o reprueba | en el editor, en el lint y en cada PR | SonarQube for IDE, eslint-plugin-sonarjs, SonarQube efímero |
| **SCA** | *Software Composition Analysis*: vulnerabilidades y licencias de las dependencias | en cada PR (Dependabot propone las actualizaciones) | Trivy fs |
| **IaC y pipeline** | Revisa la infraestructura como código y los propios workflows | en cada PR | Trivy misconfig (Dockerfiles y compose), actionlint y zizmor (workflows) |
| **Contenedores** | Vulnerabilidades del sistema operativo y librerías dentro de la imagen | después del build | Trivy image |
| **SBOM** | *Software Bill of Materials*: inventario de todo lo que trae la imagen | después del build | CycloneDX con Trivy |
| **DAST** | *Dynamic Application Security Testing*: ataca la app corriendo, como caja negra | con el stack levantado | OWASP ZAP |
| **Accesibilidad** | Reglas WCAG automatizables en cada pantalla | en cada PR (etapa 7) | axe con Playwright |
| **Fuzzing de API** | Genera miles de requests desde el contrato buscando respuestas que no cumplen | con el stack levantado | Schemathesis |

```
          SHIFT LEFT: mientras más a la izquierda, más barato corregir
 ◄──────────────────────────────────────────────────────────────────────────
  editor y      pre-commit      PR (ciclo rápido)        PR (ciclo lento)
  agente IA     .githooks/      secretos, SAST, SCA,     imagen, sistema,
  (CLAUDE.md),  gitleaks,       lint, unit, SonarQube,   DAST, rendimiento
  SonarQube     Prettier        contrato, E2E con mocks
  for IDE
```

## Compuertas y umbrales

Una compuerta es una condición explícita, versionada en el repo, que decide si el PR
puede seguir. Ninguna depende del criterio de quien mira el log.

| Compuerta | Umbral | Dónde se cambia |
| --- | --- | --- |
| Semgrep | 0 hallazgos ERROR | `.semgrep/rules.yml` y el paso "Compuerta" del job |
| Trivy fs e imagen | 0 CRITICAL que tengan parche | paso "Compuerta" de cada job |
| spec-trace | 6 tests por regla y capa como máximo, 0 huérfanos | `--max-per-layer` |
| SonarQube (quality gate) | 0 bugs, 0 vulnerabilidades, cobertura mínima 80 %, máximo 3 % de líneas duplicadas, nota de mantenibilidad A | `QUALITY_GATE` en `tools/sonarqube/run.mjs` |
| k6 | p95 menor a 500 ms y menos de 1 % de errores | `tools/perf/k6-smoke.js` |
| Lighthouse | buenas prácticas 0,9 (error), rendimiento y SEO (aviso). Sin accesibilidad: Lighthouse usa axe por debajo y axe ya corre con Playwright en la etapa 7 | `frontend/lighthouserc.json` |
| ZAP | 0 alertas High no ignoradas, 0 reglas FAIL | `tools/zap/rules.tsv` |

Se bloquea solo lo que tiene parche o es claramente un error. Una vulnerabilidad
CRITICAL sin versión corregida se informa en el PR, pero no detiene al equipo: no hay
nada que el equipo pueda hacer hoy más que documentarla.

## SonarQube efímero (etapa 5)

### Qué es SonarQube

SonarQube lee el código sin ejecutarlo (análisis estático) y busca tres tipos de problemas:

- **Bugs**: errores que harán que el programa se comporte mal, por ejemplo una condición que
  siempre es verdadera o un `if` cuyas dos ramas hacen exactamente lo mismo.
- **Vulnerabilidades**: código que un atacante podría aprovechar.
- **Code smells** ("malos olores" del código): código que funciona pero es difícil de leer o
  de cambiar, como una función muy larga o un `if` dentro de otro `if` dentro de otro. Hoy no es
  un error, pero hace más probable que alguien introduzca uno mañana.

Además marca los **security hotspots** (código sensible para la seguridad que una persona debe
revisar, como una expresión regular que podría tardar demasiado con ciertos textos), mide la
**cobertura** con el lcov que dejan los tests unitarios y la **duplicación** (bloques copiados y
pegados). Con eso calcula una nota de la A (mejor) a la E para confiabilidad, seguridad y
mantenibilidad.

### Qué es una quality gate

Es la lista de condiciones mínimas que el código debe cumplir para aprobar, como la nota mínima
de un ramo: si una condición no se cumple, el job falla y el PR no se puede integrar. La nuestra
está en `QUALITY_GATE` dentro de [`tools/sonarqube/run.mjs`](../tools/sonarqube/run.mjs):

| Condición | Umbral | Por qué |
| --- | --- | --- |
| Bugs | 0 | Un bug que SonarQube ya encontró se corrige antes de integrar |
| Vulnerabilidades | 0 | Un atacante podría aprovecharla, así que tampoco se integra |
| Cobertura de los tests unitarios | mínimo 80 % | Hoy es cerca de 86 % (líneas y ramas juntas). El umbral evita retrocesos, no es la meta |
| Líneas duplicadas | máximo 3 % | Copiar y pegar obliga a corregir el mismo error en varios lugares |
| Nota de mantenibilidad | A | Corregir los code smells debe tomar menos del 5 % de lo que costó escribir el código |

Las condiciones miran **el código completo**. La quality gate que trae SonarQube (Sonar way)
mira solo el "código nuevo" desde el análisis anterior, pero aquí cada corrida es un proyecto
nuevo y no hay análisis anterior con qué comparar.

La cobertura se mide sobre las mismas carpetas que miden Jest y Vitest (dominio y aplicación en
el backend, componentes y dominio en el frontend). Infraestructura, presentación y rutas se
prueban con integración, contrato y E2E, que no generan lcov. Qué se analiza, qué cuenta como
test y qué queda fuera está en [`sonar-project.properties`](../sonar-project.properties).

### Por qué efímero

SonarQube es un servidor: necesita una base de datos y un motor de búsqueda (Elasticsearch).
Tener uno encendido para el curso cuesta dinero y trabajo (actualizarlo, respaldarlo, protegerlo).
En vez de eso, el job lo levanta en un contenedor dentro del mismo runner de GitHub Actions, lo
usa unos minutos y lo borra. No hay nada que pagar ni nada que quede corriendo.

```
 runner de GitHub Actions (se destruye al terminar el job)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ lcov de unit-backend y unit-frontend (artefactos de la etapa 5)          │
 │        │                                                                 │
 │        ▼                                                                 │
 │ tools/sonarqube/run.mjs                                                  │
 │   1. docker run sonarqube (Community, gratis)    solo en 127.0.0.1       │
 │   2. espera /api/system/status = UP                                      │
 │   3. contraseña aleatoria para admin, token y quality gate por API       │
 │   4. docker run sonar-scanner-cli con sonar-project.properties           │
 │   5. quality gate, métricas e issues a reports/sonarqube/summary.json    │
 │   6. docker rm: el contenedor desaparece                                 │
 └────────┬─────────────────────────────────────────────────────────────────┘
          ▼
 artefacto sonarqube ──► etapa 10: sección "Calidad de código" del comentario del PR
```

La contraseña de admin se cambia por una aleatoria (y se oculta en el log con `::add-mask::`),
el token del scanner viaja por variable de entorno y el puerto solo escucha en `127.0.0.1`: nadie
más puede entrar mientras corre. Las imágenes van fijadas por versión y digest, como el resto
del pipeline.

Lo que se pierde: no hay historial entre corridas ni gráficos de tendencia, y la interfaz web
desaparece con el job. La evidencia que queda es la sección del comentario del PR, el resumen
del job y el artefacto `sonarqube`. Para mirar la interfaz completa, córrelo en tu máquina con
`--keep`.

### SonarQube for IDE, SonarJS en ESLint, SonarQube y SonarQube Cloud

Las cuatro usan las reglas de SonarJS para JavaScript y TypeScript. Cambian dónde corren y qué
ven.

| | SonarQube for IDE (antes SonarLint) | eslint-plugin-sonarjs (etapa 2) | SonarQube efímero (etapa 5) | SonarQube Cloud |
| --- | --- | --- | --- | --- |
| Dónde corre | en tu editor (VS Code, JetBrains) | dentro de ESLint, con `npm run lint` | en un contenedor temporal del runner | en los servidores de Sonar |
| Cuándo te avisa | mientras escribes | cuando corres `npm run lint` y en cada PR | en cada PR | en cada PR |
| Qué ve | el archivo abierto | archivo por archivo | todo el repo: cobertura, duplicación y quality gate | todo el repo, más historial y comentarios en el PR |
| Qué necesitas | instalar la extensión | nada, viene en `npm ci` | nada, solo minutos de Actions | una cuenta, conectar la organización de GitHub y el secreto `SONAR_TOKEN` |
| Costo | gratis | gratis | gratis | gratis para repos públicos |

Usa SonarQube for IDE para corregir mientras escribes, el lint para no subir el problema y
SonarQube en el PR para la foto completa. SonarQube Cloud sirve si quieres historial y no te
molesta crear la cuenta. Aquí preferimos que el repo funcione sin cuentas ni secretos externos.

### Correrlo en tu máquina

```bash
(cd backend && npm run test:unit) && (cd frontend && npm run test:unit)   # lcov en reports/coverage
node tools/sonarqube/run.mjs                 # puerto 19000, borra todo al terminar
node tools/sonarqube/run.mjs --port 19500    # si el 19000 está ocupado
cat reports/sonarqube/summary.md

# Para mirar la interfaz web: elige tu contraseña y deja el contenedor arriba
SONAR_ADMIN_PASSWORD='UnaClaveLarga#2026' node tools/sonarqube/run.mjs --keep
```

Necesitas Docker con unos 3 GB de RAM libres. Las dos imágenes se descargan una vez (1,5 GB) y
ocupan unos 2,5 GB en disco. Revisa que tengas espacio de sobra antes de partir: si el disco se
llena a mitad del análisis, Docker Desktop puede quedar en modo de solo lectura y hay que
reiniciarlo.

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
   sonarqube/             summary.json (quality gate, métricas e issues)
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
de mutantes, tarda varias veces lo que tarda la suite normal. Es muy efectivo, pero caro:
conviene usarlo con criterio. De noche no retrasa a nadie y su reporte muestra qué tests no verifican lo que creemos.

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
evidencia y `main` siempre verde. Una rama de feature de larga vida es un antipatrón:
acumula diferencias y se integra con dolor. Las métricas DORA miden justamente la
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
docker run --rm -v "$PWD:/src" -w /src aquasec/trivy:0.76.1 fs --scanners vuln,misconfig \
  --skip-dirs tools/__fixtures__ .
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12
pipx run zizmor .github/

# SonarQube efímero (necesita la cobertura de los unitarios)
(cd backend && npm run test:unit) && (cd frontend && npm run test:unit)
node tools/sonarqube/run.mjs             # resumen en reports/sonarqube/summary.md
```

Si en tu Docker Desktop `--network host` no llega a los puertos de tu máquina, quita esa
opción y usa `http://host.docker.internal:3101` como `BASE_URL` dentro del contenedor.
