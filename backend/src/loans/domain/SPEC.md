# SPEC · loans · capa domain

| Campo        | Valor                                                                |
| ------------ | -------------------------------------------------------------------- |
| Capa         | domain (ver `specs/architecture.md`)                                 |
| Implementa   | LOAN-R2, LOAN-R3, LOAN-R4, LOAN-R5, LOAN-R6 y LOAN-R7 de SPEC-LIB-02 |
| Tipo de test | unit sin dobles                                                      |

## Responsabilidad

Representar un préstamo, su fecha de vencimiento, su estado y la política de préstamos.

## Puede depender de / no puede depender de

- Puede: `shared/domain`.
- No puede: `@nestjs/*`, `typeorm`, `pg`, ni otras capas (ARCH-R1). No importa `books`:
  un préstamo guarda `bookId` y `bookTitle` como datos.

## Elementos

| Archivo          | Propósito                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `email.ts`       | Value object `Email`: normaliza y valida el correo                                         |
| `loan.ts`        | Entidad inmutable `Loan`: `open`, `markReturned`, `statusAt`                               |
| `loan-policy.ts` | `assertCanBorrow` y `MAX_UNRETURNED_LOANS = 3`                                             |
| `loan.errors.ts` | `LoanLimitReachedError`, `DuplicateLoanError`, `AlreadyReturnedError`, `LoanNotFoundError` |

## Reglas que implementa

| Regla   | Dónde se implementa                                                                            | Test                                      |
| ------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| LOAN-R2 | `assertCanBorrow`: máximo 3 no devueltos (activos o vencidos)                                  | `loan-policy.spec.ts`                     |
| LOAN-R3 | `Loan.open`: `dueAt = loanedAt + 14 días`                                                      | `loan.spec.ts`                            |
| LOAN-R4 | `assertCanBorrow`: sin dos préstamos no devueltos del mismo libro. Se revisa antes que LOAN-R2 | `loan-policy.spec.ts`                     |
| LOAN-R5 | `Loan.markReturned`: registra `returnedAt` o lanza `AlreadyReturnedError`                      | `loan.spec.ts`                            |
| LOAN-R6 | `Loan.statusAt(now)`: RETURNED, OVERDUE si `now > dueAt`, si no ACTIVE                         | `loan.spec.ts` (límite exacto de `dueAt`) |
| LOAN-R7 | `Email.create`: minúsculas, sin espacios alrededor, formato y máximo 254                       | `email.spec.ts`                           |

## Cómo se prueba esta capa

Tests unitarios sin dobles. Las fechas son literales ISO 8601 en UTC y el "ahora" se pasa
como parámetro: el dominio nunca lee el reloj. El estado no se guarda, se calcula.
