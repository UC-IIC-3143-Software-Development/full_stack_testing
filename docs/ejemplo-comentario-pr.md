<!-- ci-evidence -->
## 🧪 Evidencia de CI · PR #42

**❌ Hay etapas con fallas** · commit `3f2a9c1` · [ver el run](https://github.com/UC-IIC-3143-Software-Development/full_stack_testing/actions/runs/1234567890) · [artefactos](https://github.com/UC-IIC-3143-Software-Development/full_stack_testing/actions/runs/1234567890#artifacts)

### 🚦 Etapas DevSecOps

| Etapa | Qué verifica | Jobs | Estado |
| --- | --- | --- | :---: |
| **1 · Pre-commit y secretos** | gitleaks | ✅ `secretos` | ✅ |
| **2 · Calidad y especificación** | lint, tipos, arquitectura, Spectral, oasdiff, spec-trace, hadolint, actionlint, zizmor | ✅ `calidad-backend` ✅ `calidad-frontend` ✅ `contrato-openapi` ✅ `trazabilidad` ✅ `lint-infra` | ✅ |
| **3 · SAST** | Semgrep y CodeQL | ✅ `semgrep` ✅ `codeql` | ✅ |
| **4 · Dependencias (SCA)** | dependency review, npm audit, Trivy fs | ✅ `dependencias` ✅ `trivy-fs` | ✅ |
| **5 · Tests unitarios** | dominio y aplicación sin mocks, componentes con MSW | ✅ `unit-backend` ✅ `unit-frontend` | ✅ |
| **6 · Integración y contrato backend** | Testcontainers (PostgreSQL) y supertest contra el OpenAPI | ✅ `integracion-backend` | ✅ |
| **7 · E2E frontend con mock server** | Playwright + MSW: flujos, visual, estilos, layout y a11y | ✅ `e2e-frontend` | ✅ |
| **8 · Build e imágenes** | docker build, Trivy image, SBOM | ✅ `imagenes` | ✅ |
| **9 · Sistema y DAST** | smoke API, Schemathesis, Playwright @smoke, k6, Lighthouse, OWASP ZAP | ✅ `sistema` ❌ `dast` | ❌ |

### 🖥️ Frontend: flujos de usuario

Cada escenario de `specs/flows/*.feature` es un test de Playwright (playwright-bdd). El GIF es el video real de la prueba.

#### Contra el mock server (MSW, sin backend)

3 de 4 escenarios pasaron.

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
| `getHealth` | `GET /api/health` | ✅ 200 | ✅ 200 (máx. 6 ms) |
| `listBooks` | `GET /api/books` | ✅ 200 · 400 | ✅ 200 · 200 (máx. 12 ms) |
| `createBook` | `POST /api/books` | ✅ 201 · 400 · 409 | ✅ 201 · 409 · 400 (máx. 18 ms) |
| `getBook` | `GET /api/books/{bookId}` | ✅ 200 · 400 · 404 | ✅ 200 · 404 · 400 (máx. 7 ms) |
| `listLoans` | `GET /api/loans` | ✅ 200 · 400 | ✅ 200 · 400 (máx. 11 ms) |
| `createLoan` | `POST /api/loans` | ✅ 201 · 400 · 404 · 409 | ✅ 201 · 404 (máx. 21 ms) |
| `returnLoan` | `POST /api/loans/{loanId}/return` | ✅ 200 · 400 · 404 · 409 | ✅ 200 · 409 · 404 · 400 (máx. 15 ms) |

Smoke: 17 de 17 verificaciones OK en 191 ms.

#### 🧬 Schemathesis (property based testing desde el OpenAPI)

✅ 7 de 7 operaciones sin violaciones del contrato.

### 🔐 Seguridad y calidad

| Herramienta | Tipo | Resultado |
| --- | --- | --- |
| gitleaks | Secretos | ✅ 0 hallazgos |
| Semgrep | SAST | ⚠️ ERROR 0 · WARNING 1 · INFO 0 |
| CodeQL | SAST | ✅ ok (detalle en la pestaña Security) |
| Dependency review y npm audit | SCA | ✅ ok |
| Trivy fs | SCA, secretos e IaC | ✅ CRITICAL 0 · HIGH 0 · MEDIUM 1 · LOW 0 |
| Trivy imagen backend | Contenedor | ⚠️ CRITICAL 0 · HIGH 1 · MEDIUM 0 · LOW 1 |
| Trivy imagen frontend | Contenedor | ✅ CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0 |
| OWASP ZAP baseline (frontend) | DAST | ⚠️ High 0 · Medium 1 · Low 0 · Informational 1 |
| OWASP ZAP API scan (backend) | DAST | ❌ High 1 · Medium 0 · Low 0 · Informational 0 |
| Lighthouse CI | Calidad web | ✅ Rendimiento 97 · Accesibilidad 100 · Buenas prácticas 100 · SEO 91 |
| k6 | Rendimiento API | ✅ p95 21.7 ms · errores 0.00 % · 1840 solicitudes |
| spec-trace | Trazabilidad SDD | ✅ 27 de 27 reglas con tests · 0 huérfanos · 0 sobre presupuesto |

<details><summary>Hallazgos de Semgrep</summary>

- **WARNING** `biblioteca.no-console-log` en `backend/src/main.ts:14`

</details>

<details><summary>Alertas de ZAP (sin las informativas)</summary>

- **Medium** Content Security Policy (CSP) Header Not Set (2)
- **High** SQL Injection (1)

</details>

---
_Generado por la etapa 10 de `.github/workflows/ci.yml`. Este comentario se actualiza en cada push del PR. Las imágenes viven en la rama `evidence`._
