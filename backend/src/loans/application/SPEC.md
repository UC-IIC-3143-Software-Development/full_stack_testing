# SPEC · loans · capa application

| Campo        | Valor                                                                                   |
| ------------ | --------------------------------------------------------------------------------------- |
| Capa         | application (ver `specs/architecture.md`)                                               |
| Implementa   | LOAN-R1, LOAN-R2, LOAN-R4 a LOAN-R7 de SPEC-LIB-02 y RENEW-R1 a RENEW-R4 de SPEC-LIB-03 |
| Tipo de test | unit con fakes en memoria y reloj fijo                                                  |

## Responsabilidad

Orquestar préstamos, devoluciones y renovaciones dentro de una unidad de trabajo (transacción).

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
| `renew-loan.ts`      | `RenewLoan` (SPEC-LIB-03)                          |

Orden de validación de `CreateLoan`: correo (400), libro (404), LOAN-R4, LOAN-R2 y LOAN-R1 (409).

## Reglas que implementa

| Regla    | Dónde se implementa                                                                                                                                                   | Test                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| LOAN-R1  | `CreateLoan`: `book.lendCopy()` y luego `takeCopy` atómico, todo en `UnitOfWork`                                                                                      | `create-loan.spec.ts` · `loan.repository.int-spec.ts` (concurrencia real)   |
| LOAN-R2  | `CreateLoan`: `lockBorrower` y `assertCanBorrow`                                                                                                                      | `create-loan.spec.ts` · `loan.repository.int-spec.ts` (concurrencia real)   |
| LOAN-R4  | `CreateLoan` con `assertCanBorrow`                                                                                                                                    | `create-loan.spec.ts`                                                       |
| LOAN-R5  | `ReturnLoan`: `markReturned` condicional y `releaseCopy`. Responde el préstamo releído después del UPDATE, por si una renovación concurrente cambió `dueAt`           | `return-loan.spec.ts` · `loan.repository.int-spec.ts` (carrera con renovar) |
| LOAN-R6  | `ListLoans` calcula el estado con `Clock.now()`                                                                                                                       | `list-loans.spec.ts`                                                        |
| LOAN-R7  | `CreateLoan` lanza `BookNotFoundError`. `Email.create` normaliza el correo                                                                                            | `create-loan.spec.ts`                                                       |
| RENEW-R1 | `RenewLoan`: `loan.renew(clock.now())` y `markRenewed`, todo en `UnitOfWork`                                                                                          | `renew-loan.spec.ts`                                                        |
| RENEW-R2 | `RenewLoan`: si `markRenewed` devuelve false porque otra solicitud lo renovó primero, responde `RenewalLimitReachedError`                                             | `loan.repository.int-spec.ts` (concurrencia real)                           |
| RENEW-R3 | `RenewLoan`: si `markRenewed` devuelve false, vuelve a leer y, si lo devolvieron primero, responde `AlreadyReturnedError`. El orden de los errores lo fija el dominio | `loan.repository.int-spec.ts` (carrera con devolver)                        |
| RENEW-R4 | `RenewLoan` lanza `LoanNotFoundError`                                                                                                                                 | `renew-loan.spec.ts` · contrato HTTP (404)                                  |

## Cómo se prueba esta capa

Unit con `InMemoryBookRepository`, `InMemoryLoanRepository`, `InMemoryUnitOfWork` (serializa
y revierte si hay error) y `FixedClock`. Sin mocks. Las carreras entre transacciones no se
pueden probar con fakes: viven en los tests de integración con PostgreSQL.
