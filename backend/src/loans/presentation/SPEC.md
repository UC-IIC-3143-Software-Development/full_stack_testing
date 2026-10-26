# SPEC · loans · capa presentation

| Campo        | Valor                                                                |
| ------------ | -------------------------------------------------------------------- |
| Capa         | presentation (ver `specs/architecture.md`)                           |
| Implementa   | `listLoans`, `createLoan` y `returnLoan` de `specs/api/openapi.yaml` |
| Tipo de test | contrato HTTP con supertest y Testcontainers                         |

## Responsabilidad

Exponer los préstamos por HTTP y traducir los errores de negocio a los códigos del contrato.

## Puede depender de / no puede depender de

- Puede: `loans/application`, `loans/domain`, `shared/presentation`.
- No puede: `infrastructure`, `typeorm` ni `pg` (ARCH-R3).

## Elementos

| Archivo               | Propósito                                              |
| --------------------- | ------------------------------------------------------ |
| `loans.controller.ts` | Rutas `/api/loans` y `/api/loans/:loanId/return`       |
| `loan.dto.ts`         | Tipos HTTP y `toLoanResponse` (fechas en ISO 8601 UTC) |

## Reglas que implementa

| Regla   | Dónde se implementa                                                              | Test                                   |
| ------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| LOAN-R1 | `NO_COPIES_AVAILABLE` se responde 409                                            | `test/contract/loans.contract.spec.ts` |
| LOAN-R2 | `LOAN_LIMIT_REACHED` se responde 409                                             | `loans.contract.spec.ts`               |
| LOAN-R3 | `dueAt` en la respuesta de `createLoan`                                          | `loans.contract.spec.ts`               |
| LOAN-R4 | `DUPLICATE_LOAN` se responde 409                                                 | `loans.contract.spec.ts`               |
| LOAN-R5 | 200 al devolver, 409 `ALREADY_RETURNED`, 404 `LOAN_NOT_FOUND`, 400 si no es UUID | `loans.contract.spec.ts`               |
| LOAN-R7 | 400 con un correo inválido, 404 `BOOK_NOT_FOUND`                                 | `loans.contract.spec.ts`               |

## Cómo se prueba esta capa

Contrato HTTP con la app completa y PostgreSQL en Testcontainers. Un flujo completo
(prestar, agotar, listar, devolver, devolver otra vez) y un caso por código de error.
Cada respuesta se valida contra `openapi.yaml`.
