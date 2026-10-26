# SPEC · préstamos (frontend) · capas components y hooks

| Campo        | Valor                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| Capa         | `features/loans/components` y `features/loans/hooks` (ver `specs/architecture.md`) |
| Implementa   | UI-LOAN-1 a UI-LOAN-4 de SPEC-LIB-02                                               |
| Tipo de test | componentes con Vitest, Testing Library y MSW · flujos BDD · estilos · visual      |

## Responsabilidad

Pedir un libro prestado desde su detalle, buscar los préstamos de un correo y devolverlos.

## Puede depender de / no puede depender de

- Puede: `shared/domain` (fechas y estados), `shared/api` (solo desde hooks).
- No puede: llamar `fetch` directo (ARCH-R7), importar `mocks` (ARCH-R8), calcular el estado de un
  préstamo por su cuenta (lo entrega la API, LOAN-R6).

## Elementos

| Elemento                            | Propósito                                                    |
| ----------------------------------- | ------------------------------------------------------------ |
| `hooks/useCreateLoan.ts`            | `createLoan`                                                 |
| `hooks/useLoans.ts`                 | `listLoans` y `returnLoan`, actualiza en memoria al devolver |
| `components/BorrowForm.tsx`         | formulario "Pedir prestado" en el detalle del libro          |
| `components/LoansLookup.tsx`        | búsqueda por correo en "Mis préstamos"                       |
| `components/LoanList.tsx`           | lista de préstamos con etiqueta y botón "Devolver"           |
| `components/LoanStatusLabel.tsx`    | etiqueta con el token de color que define `shared/domain`    |
| `components/loan-error-messages.ts` | textos de UI-LOAN-4                                          |

## Reglas que implementa

| Regla     | Dónde se implementa                                                                | Test                                                               |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| UI-LOAN-1 | `BorrowForm` con `formatDate` (dd-mm-aaaa, America/Santiago)                       | `BorrowForm.test.tsx`, `FLOW-PRE-01`, a11y                         |
| UI-LOAN-2 | `LoanList` y `LoanStatusLabel` (`--color-info`, `--color-danger`, `--color-muted`) | `LoanList.test.tsx`, `loans.style.spec.ts`, `loans.visual.spec.ts` |
| UI-LOAN-3 | `useLoans.returnLoan` reemplaza el préstamo sin recargar                           | `LoanList.test.tsx`, `FLOW-PRE-02`                                 |
| UI-LOAN-4 | `loan-error-messages.ts`                                                           | `BorrowForm.test.tsx` (un test por código 409), `FLOW-PRE-03`      |

## Cómo se prueba esta capa

- Con el mock server de Node y el reloj fijo `2026-03-02T12:00:00Z`: `carla@uc.cl` tiene un préstamo
  activo, uno vencido y uno devuelto (`src/mocks/fixtures.ts`).
- Cada 409 de UI-LOAN-4 se fuerza con `server.use()` en su propio test.
- Lo que NO se prueba aquí: el límite de 3 préstamos, las copias ni los duplicados (LOAN-R1, R2, R4).
  Esas reglas viven en el backend. El frontend solo traduce el código de error a un mensaje.
