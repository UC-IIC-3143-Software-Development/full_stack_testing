<!-- ci-evidence -->
## 🧪 Evidencia de CI · PR #42

**❌ Hay etapas con fallas** · commit `3f2a9c1` · [ver el run](https://github.com/UC-IIC-3143-Software-Development/full_stack_testing/actions/runs/1234567890) · [artefactos](https://github.com/UC-IIC-3143-Software-Development/full_stack_testing/actions/runs/1234567890#artifacts)

### 🚦 Etapas DevSecOps

| Etapa | Qué verifica | Jobs | Estado |
| --- | --- | --- | :---: |
| **0 · Detectar cambios** | qué apps tocó el PR (paths-filter) | ✅ `cambios` | ✅ |
| **1 · Pre-commit y secretos** | gitleaks | ✅ `secretos` | ✅ |
| **2 · Calidad y especificación** | lint, tipos, arquitectura, Spectral, oasdiff, spec-trace, hadolint, actionlint, zizmor | ✅ `calidad-backend` ✅ `calidad-frontend` ✅ `contrato-openapi` ✅ `trazabilidad` ✅ `lint-infra` | ✅ |
| **3 · SAST** | Semgrep y CodeQL | ✅ `semgrep` ✅ `codeql` | ✅ |
| **4 · Dependencias (SCA)** | dependency review, npm audit, Trivy fs | ✅ `dependencias` ✅ `trivy-fs` | ✅ |
| **5 · Tests unitarios** | dominio y aplicación sin mocks, componentes con MSW | ✅ `unit-backend` ✅ `unit-frontend` | ✅ |
| **5 · Calidad de código (SonarQube)** | SonarQube efímero: bugs, vulnerabilidades, code smells, cobertura, duplicación y quality gate | ✅ `sonarqube` | ✅ |
| **6 · Integración y contrato backend** | Testcontainers (PostgreSQL) y supertest contra el OpenAPI | ✅ `integracion-backend` | ✅ |
| **7 · E2E frontend con mock server** | Playwright + MSW: flujos, visual, estilos, layout y a11y | ✅ `e2e-frontend` | ✅ |
| **8 · Build e imágenes** | docker build, Trivy image, SBOM | ✅ `imagenes` | ✅ |
| **9 · Sistema y DAST** | smoke API, Schemathesis, Playwright @smoke, k6, Lighthouse, OWASP ZAP | ✅ `sistema` ❌ `dast` | ❌ |

### 🖥️ Frontend: flujos de usuario

Cada escenario de `specs/flows/*.feature` es un test de Playwright (playwright-bdd). El GIF es el video real de la prueba.

#### Contra el mock server (MSW, sin backend)

4 de 5 escenarios pasaron.

<details open>
<summary>✅ <b>FLOW-CAT-01</b> · Buscar un libro por autor sin tildes</summary>

<img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/videos/FLOW-CAT-01.gif" width="560" alt="Video de FLOW-CAT-01">

<a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-CAT-01-1-catalogo.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-CAT-01-1-catalogo.png" width="180" alt="FLOW-CAT-01-1-catalogo.png" title="FLOW-CAT-01-1-catalogo.png"></a> <a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-CAT-01-2-resultado.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-CAT-01-2-resultado.png" width="180" alt="FLOW-CAT-01-2-resultado.png" title="FLOW-CAT-01-2-resultado.png"></a>

</details>

<details open>
<summary>✅ <b>FLOW-CAT-02</b> · Un libro sin copias aparece agotado</summary>

<img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/videos/FLOW-CAT-02.gif" width="560" alt="Video de FLOW-CAT-02">

<a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-CAT-02-1-agotado.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-CAT-02-1-agotado.png" width="180" alt="FLOW-CAT-02-1-agotado.png" title="FLOW-CAT-02-1-agotado.png"></a>

</details>

<details open>
<summary>✅ <b>FLOW-PRE-01</b> · Pedir prestado un libro disponible</summary>

<img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/videos/FLOW-PRE-01.gif" width="560" alt="Video de FLOW-PRE-01">

<a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-01-1-catalogo.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-01-1-catalogo.png" width="180" alt="FLOW-PRE-01-1-catalogo.png" title="FLOW-PRE-01-1-catalogo.png"></a> <a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-01-2-confirmacion.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-01-2-confirmacion.png" width="180" alt="FLOW-PRE-01-2-confirmacion.png" title="FLOW-PRE-01-2-confirmacion.png"></a>

</details>

<details>
<summary>❌ <b>FLOW-PRE-03</b> · No se puede superar el límite de préstamos</summary>

<img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/videos/FLOW-PRE-03.gif" width="560" alt="Video de FLOW-PRE-03">

<a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-03-1-error.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-03-1-error.png" width="180" alt="FLOW-PRE-03-1-error.png" title="FLOW-PRE-03-1-error.png"></a>

</details>

<details>
<summary>⚠️ <b>FLOW-PRE-04</b> · Renovar un préstamo al día · pasó al reintentar</summary>

<img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/videos/FLOW-PRE-04.gif" width="560" alt="Video de FLOW-PRE-04">

<a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-04-1-renovado.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-mock/screenshots/FLOW-PRE-04-1-renovado.png" width="180" alt="FLOW-PRE-04-1-renovado.png" title="FLOW-PRE-04-1-renovado.png"></a>

</details>

#### Contra el stack real (docker compose con PostgreSQL)

2 de 2 escenarios pasaron.

<details open>
<summary>✅ <b>FLOW-CAT-01</b> · Buscar un libro por autor sin tildes</summary>

<img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-fullstack/videos/FLOW-CAT-01.gif" width="560" alt="Video de FLOW-CAT-01">

<a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-fullstack/screenshots/FLOW-CAT-01-1-catalogo.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-fullstack/screenshots/FLOW-CAT-01-1-catalogo.png" width="180" alt="FLOW-CAT-01-1-catalogo.png" title="FLOW-CAT-01-1-catalogo.png"></a>

</details>

<details>
<summary>✅ <b>FLOW-PRE-01</b> · Pedir prestado un libro disponible</summary>

<img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-fullstack/videos/FLOW-PRE-01.gif" width="560" alt="Video de FLOW-PRE-01">

<a href="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-fullstack/screenshots/FLOW-PRE-01-2-confirmacion.png"><img src="https://raw.githubusercontent.com/UC-IIC-3143-Software-Development/full_stack_testing/evidence/pr-42/1234567890/evidencia-fullstack/screenshots/FLOW-PRE-01-2-confirmacion.png" width="180" alt="FLOW-PRE-01-2-confirmacion.png" title="FLOW-PRE-01-2-confirmacion.png"></a>

</details>

### ⚙️ Backend: endpoints verificados

| Operación | Método y ruta | Contrato (supertest + Testcontainers) | Smoke contra el stack real |
| --- | --- | --- | --- |
| `getHealth` | `GET /api/health` | ✅ 200 | ✅ 200 (máx. 3 ms) |
| `listBooks` | `GET /api/books` | ✅ 200 · 400 | ✅ 200 · 200 (máx. 1 ms) |
| `createBook` | `POST /api/books` | ✅ 201 · 400 · 409 | ✅ 201 · 409 · 400 (máx. 4 ms) |
| `getBook` | `GET /api/books/{bookId}` | ✅ 200 · 400 · 404 | ✅ 200 · 404 · 400 (máx. 1 ms) |
| `listLoans` | `GET /api/loans` | ✅ 200 · 400 | ✅ 200 · 400 (máx. 0 ms) |
| `createLoan` | `POST /api/loans` | ✅ 201 · 400 · 404 · 409 | ✅ 201 · 404 (máx. 1 ms) |
| `returnLoan` | `POST /api/loans/{loanId}/return` | ✅ 200 · 400 · 404 · 409 | ✅ 200 · 409 · 404 · 400 (máx. 0 ms) |
| `renewLoan` | `POST /api/loans/{loanId}/renew` | ✅ 200 · 400 · 404 · 409 | ✅ 200 · 409 (máx. 1 ms) |

Smoke: 19 de 19 verificaciones OK en 65 ms.

#### 🧬 Schemathesis (property based testing desde el OpenAPI)

✅ 8 de 8 operaciones sin violaciones del contrato.

### 🔐 Seguridad y calidad

| Herramienta | Tipo | Resultado |
| --- | --- | --- |
| gitleaks | Secretos | ✅ 0 hallazgos |
| Semgrep | SAST | ⚠️ ERROR 0 · WARNING 1 · INFO 0 |
| CodeQL | SAST | ℹ️ informativo (ver pestaña Security) |
| Dependency review y npm audit | SCA | ✅ ok |
| Trivy fs | SCA, secretos e IaC | ✅ CRITICAL 0 · HIGH 0 · MEDIUM 1 · LOW 0 |
| Trivy imagen backend | Contenedor | ⚠️ CRITICAL 0 · HIGH 1 · MEDIUM 0 · LOW 1 |
| Trivy imagen frontend | Contenedor | ✅ CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0 |
| OWASP ZAP baseline (frontend) | DAST | ⚠️ High 0 · Medium 1 · Low 0 · Informational 1 |
| OWASP ZAP API scan (backend) | DAST | ❌ High 1 · Medium 0 · Low 0 · Informational 0 |
| Lighthouse CI `/` | Calidad web | ✅ Rendimiento 97 · Accesibilidad 100 · Buenas prácticas 100 · SEO 91 |
| Lighthouse CI `/prestamos` | Calidad web | ✅ Rendimiento 95 · Accesibilidad 98 · Buenas prácticas 100 · SEO 91 |
| k6 | Rendimiento API | ✅ p95 21.7 ms · errores 0.00 % · 1840 solicitudes |
| spec-trace | Trazabilidad SDD | ✅ 27 de 27 reglas con tests · 0 huérfanos · 0 sobre presupuesto |

<details><summary>Hallazgos de Semgrep</summary>

- **WARNING** `biblioteca.no-console-log` en `backend/src/main.ts:14`

</details>

<details><summary>Alertas de ZAP (sin las informativas)</summary>

- **Medium** Content Security Policy (CSP) Header Not Set (2)
- **High** SQL Injection (1)

</details>

### 🧹 Calidad de código (SonarQube)

✅ **Quality gate aprobada** (`Biblioteca UC`) · SonarQube Community 26.10.0.133078

La quality gate es la lista de condiciones mínimas que el código debe cumplir para aprobar. SonarQube corrió en un contenedor temporal que se borró al terminar el job: este resumen y el artefacto `sonarqube` son la evidencia.

| Condición | Umbral | Valor | Estado |
| --- | --- | --- | :---: |
| Bugs | máximo 0 | 0 | ✅ |
| Vulnerabilidades | máximo 0 | 0 | ✅ |
| Cobertura de los tests unitarios | mínimo 80 % | 86,4 % | ✅ |
| Líneas duplicadas | máximo 3 % | 0,6 % | ✅ |
| Nota de mantenibilidad | A o mejor | A | ✅ |

| Métrica | Valor |
| --- | --- |
| Líneas de código | 3.412 |
| Bugs | 0 (confiabilidad A) |
| Vulnerabilidades | 0 (seguridad A) |
| Code smells | 7 (mantenibilidad A) |
| Security hotspots por revisar | 1 |
| Cobertura de los tests unitarios | 86,4 % |
| Líneas duplicadas | 0,6 % |

Las notas van de A (mejor) a E. Un code smell es código que funciona pero es difícil de leer o de cambiar.

<details><summary>Principales issues (7 de 7, de mayor a menor severidad)</summary>

| Severidad | Tipo | Dónde | Mensaje | Regla |
| --- | --- | --- | --- | --- |
| crítica | Code smell | `frontend/src/features/catalog/components/NewBookForm.tsx:29` | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. | `typescript:S3776` |
| mayor | Code smell | `frontend/src/features/loans/components/LoanList.tsx:41` | Extract this nested ternary operation into an independent statement. | `typescript:S3358` |
| mayor | Code smell | `frontend/src/features/catalog/components/BookList.module.css:22` | Unexpected duplicate selector ".grid", first used at line 5 | `css:S4666` |
| menor | Code smell | `frontend/src/features/catalog/components/BookCard.tsx:12` | Mark the props of the component as read-only. | `typescript:S6759` |
| menor | Code smell | `frontend/src/features/loans/components/BorrowForm.tsx:18` | Mark the props of the component as read-only. | `typescript:S6759` |
| menor | Code smell | `backend/src/loans/application/renew-loan.ts:57` | This assertion is unnecessary since it does not change the type of the expression. | `typescript:S4325` |
| menor | Code smell | `backend/src/books/domain/book.ts:3` | Remove this unused import of 'BookError'. | `typescript:S1128` |

</details>

<details><summary>Security hotspots por revisar (1 de 1)</summary>

Un security hotspot es código sensible para la seguridad que una persona debe revisar. No siempre es una vulnerabilidad.

| Probabilidad | Dónde | Mensaje | Regla |
| --- | --- | --- | --- |
| media | `backend/src/books/domain/isbn.ts:8` | Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service. | `typescript:S5852` |

</details>

---
_Generado por la etapa 10 de `.github/workflows/ci.yml`. Este comentario se actualiza en cada push del PR. Las imágenes viven en la rama `evidence`._
