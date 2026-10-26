# SPEC · books · capa infrastructure

| Campo        | Valor                                                      |
| ------------ | ---------------------------------------------------------- |
| Capa         | infrastructure (ver `specs/architecture.md`)               |
| Implementa   | BOOK-R2, BOOK-R4, BOOK-R5, LOAN-R1 y LOAN-R5 en PostgreSQL |
| Tipo de test | integración con Testcontainers (`postgres:17-alpine`)      |

## Responsabilidad

Persistir libros en PostgreSQL con TypeORM y garantizar en la base de datos las reglas
que no pueden depender solo del código.

## Puede depender de / no puede depender de

- Puede: `books/domain`, `books/application` (el puerto que implementa), `shared/domain`,
  `shared/infrastructure` (`TypeOrmUnitOfWork`, `isUniqueViolation`), `typeorm`.
- No puede: `presentation` ni la infraestructura de otro módulo (ARCH-R5).

## Elementos

| Archivo                                       | Propósito                                            |
| --------------------------------------------- | ---------------------------------------------------- |
| `book.orm-entity.ts`                          | Entidad de persistencia de la tabla `books`          |
| `typeorm-book.repository.ts`                  | `TypeOrmBookRepository`, implementa `BookRepository` |
| `src/database/migrations/*-initial-schema.ts` | Tabla `books`, índice único y restricciones CHECK    |

## Reglas que implementa

| Regla   | Dónde se implementa                                                                | Test                                                                  |
| ------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| BOOK-R2 | Índice único `uq_books_isbn`. El error 23505 se traduce a `IsbnAlreadyExistsError` | `book.repository.int-spec.ts` · `src/database/migrations.int-spec.ts` |
| BOOK-R4 | CHECK `ck_books_total_copies` (1 a 50) y `ck_books_available_copies` (0 a total)   | `book.repository.int-spec.ts`                                         |
| BOOK-R5 | `search_key LIKE` con `%` y `_` escapados. Orden por `title_key COLLATE "C"`       | `book.repository.int-spec.ts` (más la suite de contrato)              |
| LOAN-R1 | `takeCopy`: `UPDATE ... WHERE available_copies > 0`                                | suite de contrato · `loan.repository.int-spec.ts` (concurrencia)      |
| LOAN-R5 | `releaseCopy`: `UPDATE ... WHERE available_copies < total_copies`                  | suite de contrato                                                     |

## Cómo se prueba esta capa

Integración contra un PostgreSQL real levantado por Testcontainers (un contenedor por
corrida, migraciones reales, `TRUNCATE` entre tests). Corre la misma suite de contrato que
el fake en memoria (`bookRepositoryContract`) y además prueba la red de seguridad de la base
de datos insertando por SQL directo. Sin `synchronize`: el esquema solo cambia con migraciones.
