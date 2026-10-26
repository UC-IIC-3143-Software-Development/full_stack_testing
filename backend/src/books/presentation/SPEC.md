# SPEC · books · capa presentation

| Campo        | Valor                                                             |
| ------------ | ----------------------------------------------------------------- |
| Capa         | presentation (ver `specs/architecture.md`)                        |
| Implementa   | `listBooks`, `createBook` y `getBook` de `specs/api/openapi.yaml` |
| Tipo de test | contrato HTTP con supertest y Testcontainers                      |

## Responsabilidad

Traducir HTTP a casos de uso y respuestas, cumpliendo exactamente el contrato OpenAPI.

## Puede depender de / no puede depender de

- Puede: `books/application`, `books/domain`, `shared/presentation`.
- No puede: `infrastructure`, `typeorm` ni `pg` (ARCH-R3). El controller no toca repositorios.

## Elementos

| Archivo                                         | Propósito                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `books.controller.ts`                           | Rutas `/api/books` y `/api/books/:bookId`. Sin reglas de negocio |
| `book.dto.ts`                                   | Tipos HTTP y `toBookResponse`                                    |
| `shared/presentation/openapi/*`                 | Valida cada request contra el contrato (sin DTOs duplicados)     |
| `shared/presentation/problem-details.filter.ts` | Errores como `application/problem+json` (RFC 9457)               |

## Reglas que implementa

| Regla   | Dónde se implementa                                                                                 | Test                                   |
| ------- | --------------------------------------------------------------------------------------------------- | -------------------------------------- |
| BOOK-R1 | El filtro convierte `DomainValidationError` en 400 `VALIDATION_ERROR` con `errors[{field: 'isbn'}]` | `test/contract/books.contract.spec.ts` |
| BOOK-R2 | `ISBN_ALREADY_EXISTS` se responde 409                                                               | `books.contract.spec.ts`               |
| BOOK-R4 | El middleware rechaza `totalCopies` fuera de 1 a 50 y campos desconocidos                           | `books.contract.spec.ts`               |
| BOOK-R5 | `GET /api/books?q=` (máximo 100 caracteres según el contrato)                                       | `books.contract.spec.ts`               |
| BOOK-R6 | `BOOK_NOT_FOUND` se responde 404. Un `bookId` que no es UUID, 400                                   | `books.contract.spec.ts`               |

## Cómo se prueba esta capa

Tests de contrato: la app completa (`AppModule` real, sin overrides) contra PostgreSQL en
Testcontainers, por HTTP con supertest. Cada respuesta se valida contra `openapi.yaml`
(status documentado, Content-Type y schema). En CI, Schemathesis hace fuzzing desde el
mismo contrato. Aquí no se repiten las particiones del dominio: basta un caso por código HTTP.
