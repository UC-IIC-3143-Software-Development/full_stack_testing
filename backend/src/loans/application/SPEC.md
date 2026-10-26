# SPEC · loans · capa application

| Campo        | Valor                                                                |
| ------------ | -------------------------------------------------------------------- |
| Capa         | application (ver `specs/architecture.md`)                            |
| Implementa   | LOAN-R1, LOAN-R2, LOAN-R4, LOAN-R5, LOAN-R6 y LOAN-R7 de SPEC-LIB-02 |
| Tipo de test | unit con fakes en memoria y reloj fijo                               |

## Responsabilidad

Orquestar préstamos y devoluciones dentro de una unidad de trabajo (transacción).

## Puede depender de / no puede depender de

- Puede: `loans/domain`, `books/domain` (errores), `books/application` (puerto
  `BookRepository`, ARCH-R5), `shared/application` (`Clock`, `UnitOfWork`).
- No puede: `infrastructure`, `presentation`, `@nestjs/*`, `typeorm` (ARCH-R2).

## Elementos

| Archivo              | Propósito                                          |
| -------------------- | -------------------------------------------------- |
| `loan.repository.ts` | Puerto `LoanRepository` y token `LOAN_REPOSITORY`  |
| `loan-details.ts`    | `LoanDetails`: el préstamo más su estado calculado |
| `create-loan.ts`     | `CreateLoan`                                       |
| `list-loans.ts`      | `ListLoans`                                        |
| `return-loan.ts`     | `ReturnLoan`                                       |

Orden de validación de `CreateLoan`: correo (400), libro (404), LOAN-R4, LOAN-R2 y LOAN-R1 (409).

## Reglas que implementa

| Regla   | Dónde se implementa                                                              | Test                                                                      |
| ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| LOAN-R1 | `CreateLoan`: `book.lendCopy()` y luego `takeCopy` atómico, todo en `UnitOfWork` | `create-loan.spec.ts` · `loan.repository.int-spec.ts` (concurrencia real) |
| LOAN-R2 | `CreateLoan`: `lockBorrower` y `assertCanBorrow`                                 | `create-loan.spec.ts` · `loan.repository.int-spec.ts` (concurrencia real) |
| LOAN-R4 | `CreateLoan` con `assertCanBorrow`                                               | `create-loan.spec.ts`                                                     |
| LOAN-R5 | `ReturnLoan`: `markReturned` condicional y `releaseCopy`                         | `return-loan.spec.ts`                                                     |
| LOAN-R6 | `ListLoans` calcula el estado con `Clock.now()`                                  | `list-loans.spec.ts`                                                      |
| LOAN-R7 | `CreateLoan` lanza `BookNotFoundError`. `Email.create` normaliza el correo       | `create-loan.spec.ts`                                                     |

## Cómo se prueba esta capa

Unit con `InMemoryBookRepository`, `InMemoryLoanRepository`, `InMemoryUnitOfWork` (serializa
y revierte si hay error) y `FixedClock`. Sin mocks. Las carreras entre transacciones no se
pueden probar con fakes: viven en los tests de integración con PostgreSQL.
