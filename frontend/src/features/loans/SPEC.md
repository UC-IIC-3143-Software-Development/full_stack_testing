# SPEC · préstamos (frontend) · capas components y hooks

| Campo        | Valor                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| Capa         | `features/loans/components` y `features/loans/hooks` (ver `specs/architecture.md`) |
| Implementa   | UI-LOAN-1 a UI-LOAN-4 de SPEC-LIB-02 y UI-RENEW-1, UI-RENEW-2 de SPEC-LIB-03       |
| Tipo de test | componentes con Vitest, Testing Library y MSW · flujos BDD · estilos · visual      |

## Responsabilidad

Pedir un libro prestado desde su detalle, buscar los préstamos de un correo, devolverlos y renovarlos.

## Puede depender de / no puede depender de

- Puede: `shared/domain` (fechas y estados), `shared/api` (solo desde hooks, los componentes solo importan
  tipos, ARCH-R7). Los hooks entregan los errores por campo ya calculados (`fieldErrors`).
- No puede: llamar `fetch` directo (ARCH-R7), importar `mocks` (ARCH-R8), calcular el estado de un
  préstamo por su cuenta (lo entrega la API, LOAN-R6).

## Elementos

| Elemento                            | Propósito                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `hooks/useCreateLoan.ts`            | `createLoan`                                                                        |
| `hooks/useLoans.ts`                 | `listLoans`, `returnLoan` y `renewLoan`, actualiza en memoria al devolver o renovar |
| `components/BorrowForm.tsx`         | formulario "Pedir prestado" en el detalle del libro                                 |
| `components/LoansLookup.tsx`        | búsqueda por correo en "Mis préstamos"                                              |
| `components/LoanList.tsx`           | lista de préstamos con etiqueta y botones "Devolver" y "Renovar"                    |
| `components/LoanStatusLabel.tsx`    | etiqueta con el token de color que define `shared/domain`                           |
| `components/loan-error-messages.ts` | textos de UI-LOAN-4 y UI-RENEW-2                                                    |

## Reglas que implementa

| Regla      | Dónde se implementa                                                                                                                                              | Test                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| UI-LOAN-1  | `BorrowForm` con `formatDate` (dd-mm-aaaa, America/Santiago)                                                                                                     | `BorrowForm.test.tsx`, `FLOW-PRE-01`, a11y                                                       |
| UI-LOAN-2  | `LoanList` y `LoanStatusLabel` (`--color-info`, `--color-danger`, `--color-muted`)                                                                               | `LoanList.test.tsx`, `loans.style.spec.ts`, `loans.visual.spec.ts`                               |
| UI-LOAN-3  | `useLoans.returnLoan` reemplaza el préstamo sin recargar, `LoanList` anuncia en `role="status"` y enfoca el título                                               | `LoanList.test.tsx`, `FLOW-PRE-02`                                                               |
| UI-LOAN-4  | `loan-error-messages.ts`                                                                                                                                         | `BorrowForm.test.tsx` (un test por código 409), `FLOW-PRE-03`                                    |
| UI-RENEW-1 | `LoanList` (`canRenew`: estado `ACTIVE` y `renewalCount` 0) y `useLoans.renewLoan`, que reemplaza el préstamo sin recargar, anuncia la fecha y enfoca "Devolver" | `LoanList.test.tsx` (visibilidad en sus cuatro particiones, renovación y anuncio), `FLOW-PRE-04` |
| UI-RENEW-2 | `loan-error-messages.ts` (`RENEW_CONFLICT_MESSAGES` y `loanActionMessage`)                                                                                       | `LoanList.test.tsx` (un test por código 409)                                                     |

## Cómo se prueba esta capa

- Con el mock server de Node y el reloj fijo `2026-03-02T12:00:00Z`: `carla@uc.cl` tiene un préstamo
  activo, uno vencido y uno devuelto (`src/mocks/fixtures.ts`).
- Cada 409 de UI-LOAN-4 y de UI-RENEW-2 se fuerza con `server.use()` en su propio test.
- El préstamo activo ya renovado de UI-RENEW-1 se siembra en la base fake con `mockStore.write()`
  dentro del mismo test (activo sin renovar, activo renovado, vencido y devuelto en un solo caso).
- Lo que NO se prueba aquí: el límite de 3 préstamos, las copias ni los duplicados (LOAN-R1, R2, R4).
  Esas reglas viven en el backend. El frontend solo traduce el código de error a un mensaje.
- Tampoco se prueban aquí los 7 días ni el límite de una renovación (RENEW-R1 a RENEW-R4). Viven en el
  dominio del backend. El frontend muestra la fecha que responde la API y decide si ofrece el botón.
