# SPEC · loans · capa infrastructure

| Campo        | Valor                                                 |
| ------------ | ----------------------------------------------------- |
| Capa         | infrastructure (ver `specs/architecture.md`)          |
| Implementa   | LOAN-R2, LOAN-R4, LOAN-R5 y LOAN-R7 en PostgreSQL     |
| Tipo de test | integración con Testcontainers (`postgres:17-alpine`) |

## Responsabilidad

Persistir préstamos y garantizar en la base de datos las reglas que dependen de la concurrencia.

## Puede depender de / no puede depender de

- Puede: `loans/domain`, `loans/application`, `shared/infrastructure`, `typeorm`.
- No puede: `presentation` ni `books/infrastructure` (ARCH-R5). El título del libro se lee
  con un `JOIN` en SQL, no importando la entidad de `books`.

## Elementos

| Archivo                      | Propósito                                            |
| ---------------------------- | ---------------------------------------------------- |
| `loan.orm-entity.ts`         | Entidad de persistencia de la tabla `loans`          |
| `typeorm-loan.repository.ts` | `TypeOrmLoanRepository`, implementa `LoanRepository` |
| `src/database/migrations/*`  | Tabla `loans`, FK a `books` e índice único parcial   |

## Reglas que implementa

| Regla   | Dónde se implementa                                                                                                             | Test                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| LOAN-R2 | `lockBorrower`: `pg_advisory_xact_lock(3143, hashtext(correo))` hasta el fin de la transacción                                  | `loan.repository.int-spec.ts` (concurrencia)      |
| LOAN-R4 | Índice único parcial `uq_loans_unreturned_book_borrower ... WHERE returned_at IS NULL`. 23505 se traduce a `DuplicateLoanError` | `loan.repository.int-spec.ts` · suite de contrato |
| LOAN-R5 | `markReturned`: `UPDATE ... WHERE returned_at IS NULL`                                                                          | suite de contrato                                 |
| LOAN-R7 | `findByBorrower`: por correo normalizado, `ORDER BY loaned_at DESC, id`                                                         | suite de contrato                                 |

## Cómo se prueba esta capa

Integración con PostgreSQL real. La suite `loanRepositoryContract` corre aquí y contra el
fake. Los tests de concurrencia usan una barrera (`holdBookRows` con `FOR UPDATE` y
`waitForBlockedSessions`) para que las solicitudes compitan de verdad: sin la barrera la
carrera casi nunca ocurre y el test pasaría aunque faltara el lock.
