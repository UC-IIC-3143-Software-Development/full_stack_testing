# SPEC · books · capa domain

| Campo        | Valor                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| Capa         | domain (ver `specs/architecture.md`)                                               |
| Implementa   | BOOK-R1, BOOK-R3, BOOK-R4, BOOK-R5 (claves) y LOAN-R1 de SPEC-LIB-01 y SPEC-LIB-02 |
| Tipo de test | unit sin dobles                                                                    |

## Responsabilidad

Representar un libro del catálogo y sus reglas puras: ISBN-13, título, autor y copias.

## Puede depender de / no puede depender de

- Puede: `shared/domain` (`DomainError`, `normalizeForSearch`).
- No puede: `@nestjs/*`, `typeorm`, `pg`, ni las capas `application`, `infrastructure` o `presentation` (ARCH-R1).

## Elementos

| Archivo          | Propósito                                                                          |
| ---------------- | ---------------------------------------------------------------------------------- |
| `isbn.ts`        | Value object `Isbn`: normaliza y valida un ISBN-13                                 |
| `book.ts`        | Entidad inmutable `Book`: `create`, `restore`, `lendCopy`, `searchKey`, `titleKey` |
| `book.errors.ts` | `IsbnAlreadyExistsError`, `BookNotFoundError`, `NoCopiesAvailableError`            |

## Reglas que implementa

| Regla   | Dónde se implementa                                                   | Test           |
| ------- | --------------------------------------------------------------------- | -------------- |
| BOOK-R1 | `Isbn.create`: quita guiones y espacios, 978/979, dígito verificador  | `isbn.spec.ts` |
| BOOK-R3 | `Book.create`: recorta, no vacío, máximo 200 y 120 caracteres         | `book.spec.ts` |
| BOOK-R4 | `Book.create`: entero entre 1 y 50, disponibles = totales             | `book.spec.ts` |
| BOOK-R5 | `Book.searchKey` y `Book.titleKey` (sin tildes ni mayúsculas)         | `book.spec.ts` |
| LOAN-R1 | `Book.lendCopy`: descuenta una copia o lanza `NoCopiesAvailableError` | `book.spec.ts` |

BOOK-R2 y BOOK-R6 solo definen su error aquí. La decisión vive en `application`.

## Cómo se prueba esta capa

Tests unitarios sin ningún doble: se crean objetos reales y se comparan con valores
literales. Se prueban particiones y límites (200 y 201 caracteres, 1 y 50 copias).
No se prueba aquí la unicidad del ISBN (application y base de datos), la búsqueda en
PostgreSQL (integration) ni los códigos HTTP (contract).
