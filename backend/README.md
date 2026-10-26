# Backend: API de la Biblioteca UC

API REST de la Biblioteca UC hecha con **NestJS 12**, **TypeORM 1.x** y **PostgreSQL 17**.
Implementa exactamente [`specs/api/openapi.yaml`](../specs/api/openapi.yaml) y las reglas
`BOOK-R1` a `BOOK-R6` ([SPEC-LIB-01](../specs/features/SPEC-LIB-01-catalogo.md)),
`LOAN-R1` a `LOAN-R7` ([SPEC-LIB-02](../specs/features/SPEC-LIB-02-prestamos.md)) y
`RENEW-R1` a `RENEW-R4` ([SPEC-LIB-03](../specs/features/SPEC-LIB-03-renovacion.md)).

Es material de clase: el código es corto a propósito y los comentarios explican el porqué.

## Cómo correrlo

Requisitos: Node 24 o superior y Docker (para PostgreSQL y Testcontainers).

```bash
npm ci

# PostgreSQL en un puerto aleatorio del host (no choca con otra base de datos local)
docker run -d --name biblioteca-pg -e POSTGRES_USER=biblioteca -e POSTGRES_PASSWORD=biblioteca \
  -e POSTGRES_DB=biblioteca -p 127.0.0.1::5432 postgres:17-alpine
PGPORT=$(docker port biblioteca-pg 5432 | cut -d: -f2)

export DATABASE_URL="postgres://biblioteca:biblioteca@127.0.0.1:$PGPORT/biblioteca"
export CLOCK_FIXED_NOW=2026-03-02T12:00:00Z   # opcional: fecha fija de prueba, como en los tests
npm run build && npm run start:prod           # las migraciones corren al iniciar
npm run seed                                  # carga los libros de specs/flows/README.md

curl http://localhost:3001/api/health         # {"status":"ok"}
```

| Variable            | Valor por defecto                                            | Uso                                             |
| ------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `PORT`              | `3001`                                                       | Puerto HTTP. Todas las rutas van bajo `/api`    |
| `DATABASE_URL`      | `postgres://biblioteca:biblioteca@localhost:5432/biblioteca` | Conexión a PostgreSQL                           |
| `CLOCK_FIXED_NOW`   | sin valor                                                    | Fija "hoy" (ISO 8601). Solo pruebas y evidencia |
| `OPENAPI_PATH`      | `../specs/api/openapi.yaml`                                  | Contrato que usa el validador de requests       |
| `DB_RUN_MIGRATIONS` | `true`                                                       | `false` evita correr migraciones al iniciar     |
| `API_URL` (seed)    | `http://localhost:3001`                                      | Backend donde `npm run seed` carga datos        |

## Arquitectura en capas

```
HTTP ──► presentation ──► application ──► domain
                              │              ▲
                              ▼              │
                        infrastructure ──────┘
```

```
src/
├── books/                  Catálogo (SPEC-LIB-01)
│   ├── domain/             Isbn, Book, errores. TypeScript puro
│   ├── application/        CreateBook, ListBooks, GetBook y el puerto BookRepository
│   ├── infrastructure/     TypeOrmBookRepository y entidad de persistencia
│   ├── presentation/       BooksController
│   └── books.module.ts     Composición: qué adaptador implementa cada puerto
├── loans/                  Préstamos y renovaciones (SPEC-LIB-02 y SPEC-LIB-03), mismas cuatro capas
├── health/                 GET /api/health (SELECT 1)
├── shared/                 Núcleo compartido: Clock, UnitOfWork, errores, validación OpenAPI
├── database/               Data source, migraciones y script de migración
├── app.module.ts · app.setup.ts · main.ts
```

Cada capa de `books` y `loans` tiene su `SPEC.md` con sus responsabilidades, de qué puede
depender y la tabla **regla, dónde, test**. Es la spec que se usó para construir esa capa.

Las reglas `ARCH-R1` a `ARCH-R5` de [`specs/architecture.md`](../specs/architecture.md) se
verifican con dependency-cruiser (`npm run test:arch`, configuración en `.dependency-cruiser.cjs`).
Si alguien importa TypeORM desde el dominio, el build de CI falla con el ID de la regla.

Decisiones que vale la pena mirar:

- **Los casos de uso no conocen Nest.** Son clases normales que reciben puertos en el
  constructor. Nest los crea con `useFactory` en `*.module.ts`.
- **El reloj es un puerto.** Nadie llama a `new Date()` salvo `SystemClock`. Con
  `CLOCK_FIXED_NOW` la app entera usa `FixedClock`.
- **Transacciones sin TypeORM en la aplicación.** `UnitOfWork.run()` es un puerto. Su
  implementación (`TypeOrmUnitOfWork`) guarda el EntityManager de la transacción en un
  `AsyncLocalStorage` y los repositorios lo usan sin enterarse.
- **La base de datos también defiende las reglas** (cap. 5 del libro, _data testing_):
  índice único de ISBN (BOOK-R2), `CHECK` de copias (BOOK-R4), índice único parcial de
  préstamos no devueltos (LOAN-R4), `UPDATE` condicional para la última copia (LOAN-R1),
  `pg_advisory_xact_lock` por correo (LOAN-R2) y, para la renovación, `CHECK` de
  `renewal_count` entre 0 y 1 más un `UPDATE` condicional sobre `renewal_count` (RENEW-R2).

## Validación guiada por el contrato

No hay DTOs con decoradores que copien los schemas. `OpenApiValidationMiddleware` valida
cada request (ruta, query y body) contra `specs/api/openapi.yaml` con Ajv (JSON Schema 2020-12).
Si el contrato cambia, la validación cambia sola.

- Un error de validación responde `400` `application/problem+json` (RFC 9457) con
  `code: VALIDATION_ERROR` y `errors[{field, message}]` en español.
- Las reglas que el contrato no puede expresar (dígito verificador del ISBN, título vacío
  después de recortar) viven en el dominio y salen con el mismo formato.
- Un método no declarado para una ruta del contrato responde `405` con el header `Allow`.
- Ningún input inválido produce un `500`: lo verifica Schemathesis en CI.

## Tipos de test

| Script                     | Qué prueba                                                   | Dobles                                  |                      Tests | Cuándo  |
| -------------------------- | ------------------------------------------------------------ | --------------------------------------- | -------------------------: | ------- |
| `npm run test:unit`        | Dominio y casos de uso                                       | ninguno en dominio, fakes en aplicación |                         63 | cada PR |
| `npm run test:integration` | Repositorios, restricciones, concurrencia y migraciones      | ninguno: PostgreSQL real                |                         22 | cada PR |
| `npm run test:contract`    | La API completa por HTTP, validada contra `openapi.yaml`     | ninguno: app real y PostgreSQL          |                         15 | cada PR |
| `npm run test:arch`        | Reglas de dependencia entre capas (ARCH-R1 a ARCH-R5)        | no aplica                               |                   5 reglas | cada PR |
| `npm run test:mutation`    | Calidad de los tests unitarios (Stryker)                     | no aplica                               |                  no aplica | nightly |
| Schemathesis (en CI)       | Fuzzing desde el contrato: sin 500, status y schemas válidos | no aplica                               | cientos de casos generados | cada PR |

Además: `npm run lint` (ESLint con reglas de tipos y `eslint-plugin-security`),
`npm run format:check` (Prettier) y `npm run typecheck`.

Cada test nombra en su título la regla que verifica, por ejemplo
`[LOAN-R2] rechaza el cuarto préstamo`. Así `tools/spec-trace.mjs` cruza specs y tests, y un
test sin ID es un test huérfano. Presupuesto: como máximo 6 tests por regla y por capa.

Los reportes quedan en `reports/`: cobertura (`reports/coverage`), JUnit
(`reports/junit/*.xml`), cobertura del contrato (`reports/contract-coverage.json`) y
mutación (`reports/mutation`).

### Unit: fakes en vez de mocks

Un mock (`jest.fn()`) responde lo que el test le dice y verifica qué métodos se llamaron.
El test queda pegado a la implementación y puede pasar aunque el sistema real no funcione.
Un **fake** es una implementación real y simple: `InMemoryBookRepository` guarda libros en
un `Map`, rechaza ISBN repetidos y descuenta copias de verdad. El test verifica el **estado
final**, no las llamadas.

Pero un fake puede mentir: si se aleja del repositorio de PostgreSQL, los tests unitarios
pasan y producción falla. Por eso existe la **suite de contrato de repositorio**
(`test/repository-contract/`): las mismas pruebas corren contra el fake en `test:unit` y
contra el repositorio TypeORM en `test:integration`.

```ts
// test/fakes/in-memory-repositories.spec.ts (unit)
bookRepositoryContract('fake en memoria', async () => new InMemoryBookRepository())

// src/books/infrastructure/book.repository.int-spec.ts (integración)
bookRepositoryContract('PostgreSQL', async () => new TypeOrmBookRepository(unitOfWork))
```

`InMemoryUnitOfWork` también se comporta como una transacción: ejecuta de a una y revierte
si hay un error. La ESLint de tests prohíbe `jest.fn`, `jest.mock`, `jest.spyOn`,
`toBeDefined`, `toBeTruthy` y `setTimeout` (constitución P4).

### Integración: qué es Testcontainers

[Testcontainers](https://testcontainers.com) levanta contenedores Docker desde el código de
los tests. `test/support/postgres-global-setup.ts` arranca **un** `postgres:17-alpine` por
corrida en un puerto libre al azar, entrega su URL a los tests y lo elimina al final. Los
tests usan las migraciones reales y vacían las tablas entre cada caso.

La ventaja frente a SQLite o una base en memoria: pruebas el mismo motor de producción, con
sus índices parciales, `CHECK`, locks y niveles de aislamiento. Lo único que necesitas es
Docker. Si ya tienes un PostgreSQL desechable (por ejemplo un _service container_ de CI),
define `TEST_DATABASE_URL` y el setup lo usa en vez de levantar un contenedor.

**Concurrencia determinista.** Una carrera entre dos transacciones casi nunca ocurre sola en
un test: abrir una conexión tarda más que la transacción completa. Los tests de LOAN-R1 y
LOAN-R2 usan una barrera: una transacción aparte bloquea las filas con `FOR UPDATE`, el test
espera (consultando `pg_stat_activity`, sin `sleep`) a que todas las solicitudes estén
bloqueadas y recién entonces las libera. Si quitas el advisory lock o el `WHERE
available_copies > 0`, el test falla. RENEW-R2 usa la misma barrera sobre la fila del
préstamo: dos renovaciones simultáneas, exactamente una gana. Si el `UPDATE` de
`markRenewed` no exige `renewal_count` anterior, las dos responden 200 y el test falla.

### Contrato: la API completa contra el OpenAPI

Los tests de `test/contract/` levantan la app real (`AppModule` sin overrides, con la misma
configuración de `main.ts`) contra PostgreSQL en Testcontainers y la recorren por HTTP con
supertest: crear un libro, buscar, prestar, agotar, listar, devolver, devolver otra vez,
renovar y renovar otra vez.

Cada respuesta pasa por `expectToMatchContract(response, 'createLoan')`, que verifica que el
status esté documentado para esa operación, que el `Content-Type` sea el del contrato y que
el cuerpo cumpla el schema (Ajv 2020 sobre el documento desreferenciado). Al final, un test
verifica que **cada operationId** tenga al menos un test y escribe
`reports/contract-coverage.json`, que el pipeline publica en el PR.

### Fuzzing con Schemathesis

[Schemathesis](https://schemathesis.readthedocs.io) lee el OpenAPI y genera cientos de
requests válidas e inválidas. En CI se usa con la app y PostgreSQL corriendo:

```bash
schemathesis run specs/api/openapi.yaml --url http://localhost:3001 \
  --checks not_a_server_error,status_code_conformance,content_type_conformance,response_schema_conformance
```

Encontró casos reales que ningún humano escribió: un `\u0000` en un texto (PostgreSQL no lo
acepta y respondía 500) y un UUID con prefijo `urn:uuid:` (válido para Ajv, inválido para
PostgreSQL). Ambos ahora responden 400.

### Mutación con Stryker

Stryker cambia el código (por ejemplo `>` por `>=` o borra el `^` de una regex) y corre los
tests: si ninguno falla, el mutante sobrevive y revela un test que falta. Lo que nos enseñó
en este repo:

- Sobrevivía el mutante que borraba `^` y `$` del patrón del ISBN. Se agregaron dos casos de
  14 dígitos a `isbn.spec.ts` y `isbn.ts` quedó en 100%.
- Sobrevivía el mutante que borraba un `findByIsbn` previo en `CreateBook`. Era un mutante
  **equivalente**: el repositorio ya rechaza el ISBN repetido. La solución fue borrar el
  código redundante, no escribir otro test.
- Hoy el score es cercano a 91%. Los sobrevivientes son textos de mensajes de error. No se
  persiguen: un test por cada texto no detecta defectos reales y es justo el tipo de test
  que una IA genera por miles. El score es una señal para revisar, no una meta.

Con este tamaño de proyecto tarda unos 15 segundos, pero crece con el código. Por eso
corre en el pipeline nightly y no en cada PR.

## Reglas de SonarQube y SonarLint en el lint (SonarJS)

SonarQube revisa la calidad del código. Sus reglas para JavaScript y TypeScript se llaman
**SonarJS**, y SonarSource (la empresa detrás de SonarQube) las publica gratis como plugin de ESLint:
[`eslint-plugin-sonarjs`](https://www.npmjs.com/package/eslint-plugin-sonarjs). Son las mismas
reglas que usan SonarQube y SonarLint, así que tienes sus hallazgos sin pagar ni levantar un
servidor. Buscan tres cosas:

- **Bugs**: código que probablemente hace algo distinto de lo que crees.
- **Code smells** (código con "mal olor"): funciona, pero cuesta leerlo o cambiarlo sin romper algo.
- **Security hotspots** (puntos de seguridad a revisar): código sensible que una persona debe
  mirar para decidir si es seguro.

Usamos la config `recommended` en `eslint.config.mjs`. Corre con `npm run lint` y en CI en la
etapa 2 (job `calidad-backend`): un hallazgo hace fallar el PR. Al activarla encontró 6:

| Regla                       | Dónde                                          | Qué se hizo                                                                                |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `super-linear-regex`        | `templateToRegExp`                             | `/\{[^}]+\}/` pasó a `/\{[^{}]+\}/`. Con 50.000 `{` sin cerrar tardaba 3,8 s y ahora 0 ms  |
| `cognitive-complexity`      | `findNulCharacter`                             | Tenía complejidad 25 (el máximo es 15). Se separó en dos funciones                         |
| `no-nested-conditional` (3) | `fieldOf`, `messageFor` y el fake de préstamos | Ternarios dentro de ternarios pasaron a `if`                                               |
| `no-empty-test-file`        | `test/fakes/in-memory-repositories.spec.ts`    | Falso positivo: los tests vienen de funciones importadas. Se desactivó solo en ese archivo |

La **complejidad cognitiva** mide cuánto cuesta entender una función: suma un punto por cada
`if`, `for` o `catch`, y más si están unos dentro de otros. Si una regla no aplica, se desactiva
solo donde no aplica y con un comentario que explica por qué, como con `eslint-plugin-security`.

**En el editor.** VS Code (con la extensión ESLint) y Zed (trae ESLint) muestran estos hallazgos
mientras escribes. Si no ves nada, abre la carpeta `backend/` y no la raíz del repo, o en VS Code
agrega `"eslint.workingDirectories": [{ "mode": "auto" }]` a tu configuración. Para VS Code y
JetBrains existe además la extensión gratuita **SonarQube for IDE** (antes SonarLint): explica
cada regla con ejemplos y trae algunas reglas más. Lo que decide si el PR pasa es `npm run lint`.

## Imagen Docker

El contexto de build es la raíz del repo, porque el contrato vive en `specs/`:

```bash
docker build -f backend/Dockerfile -t biblioteca-backend .
```

Multi-stage sobre `node:24-alpine`, `npm ci --ignore-scripts`, sin devDependencies,
usuario `node` (no root), `HEALTHCHECK` contra `/api/health` y migraciones al iniciar.
`backend/Dockerfile.dockerignore` es una lista blanca: al contexto solo entra lo necesario.

## Agregar una regla nueva (flujo SDD)

1. Escribe la regla con ID en la spec de la feature (por ejemplo `LOAN-R8`).
2. Si cambia la API, cambia primero `specs/api/openapi.yaml`.
3. Actualiza el `SPEC.md` de cada capa que cambia (tabla regla, dónde, test).
4. Propón la lista de casos (regla, capa, partición) y espera aprobación. Luego escribe los
   tests que fallan, en la capa más baja posible.
5. Implementa hasta que `lint`, `typecheck`, `test:arch` y todos los `test:*` queden en verde.
