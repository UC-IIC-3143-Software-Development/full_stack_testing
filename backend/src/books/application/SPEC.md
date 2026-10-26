# SPEC · books · capa application

| Campo        | Valor                                              |
| ------------ | -------------------------------------------------- |
| Capa         | application (ver `specs/architecture.md`)          |
| Implementa   | BOOK-R2, BOOK-R4, BOOK-R5 y BOOK-R6 de SPEC-LIB-01 |
| Tipo de test | unit con fakes en memoria y fecha fija de prueba   |

## Responsabilidad

Orquestar los casos de uso del catálogo usando el dominio y el puerto `BookRepository`.

## Puede depender de / no puede depender de

- Puede: `books/domain`, `shared/domain`, `shared/application` (puerto `Clock`).
- No puede: `infrastructure`, `presentation`, `@nestjs/*`, `typeorm`, `pg` (ARCH-R2).
  Los casos de uso son clases sin decoradores. Nest los crea con `useFactory` en `books.module.ts`.

## Elementos

| Archivo              | Propósito                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| `book.repository.ts` | Puerto `BookRepository` y token `BOOK_REPOSITORY`. Lo usa también `loans` |
| `create-book.ts`     | `CreateBook`: crea el libro con la hora del reloj                         |
| `list-books.ts`      | `ListBooks`: delega la búsqueda al puerto                                 |
| `get-book.ts`        | `GetBook`: busca por id o lanza `BookNotFoundError`                       |

## Reglas que implementa

| Regla             | Dónde se implementa                                                                    | Test                                                                           |
| ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| BOOK-R2           | `CreateBook` delega en `add`, que por contrato del puerto rechaza un ISBN repetido     | `create-book.spec.ts` · `test/repository-contract/book-repository.contract.ts` |
| BOOK-R4           | `CreateBook` guarda `availableCopies = totalCopies` y `createdAt` del reloj            | `create-book.spec.ts`                                                          |
| BOOK-R5           | `ListBooks` delega en `BookRepository.search` (orden y filtro definidos por el puerto) | `book-repository.contract.ts`                                                  |
| BOOK-R6           | `GetBook` lanza `BookNotFoundError`                                                    | `get-book.spec.ts`                                                             |
| LOAN-R1 y LOAN-R5 | El puerto define `takeCopy` y `releaseCopy` atómicos                                   | `book-repository.contract.ts`                                                  |

## Cómo se prueba esta capa

Tests unitarios con `InMemoryBookRepository` y `FixedClock` (`test/support/application-harness.ts`).
Sin `jest.fn()`: se verifica el estado final del repositorio, no qué métodos se llamaron.
El fake no miente porque pasa la misma suite de contrato que el repositorio de PostgreSQL.
Las validaciones de campos ya probadas en `domain` no se repiten aquí.
