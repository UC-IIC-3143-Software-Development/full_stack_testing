# SPEC-LIB-03 · Renovar préstamo

| Campo              | Valor                                                              |
| ------------------ | ------------------------------------------------------------------ |
| ID                 | SPEC-LIB-03 · versión 1                                            |
| Contrato API       | `specs/api/openapi.yaml` (`renewLoan`, nuevo campo `renewalCount` en `Loan`) |
| Flujos de usuario  | `specs/flows/prestamos.feature` (`FLOW-PRE-04`)                    |
| Depende de         | SPEC-LIB-02                                                        |
| Specs por capa     | `backend/src/loans/*/SPEC.md`, `frontend/src/features/loans/SPEC.md` |

## Contexto

Las personas piden poder extender un préstamo sin ir a la biblioteca. Esta spec agrega una
renovación simple: una sola vez por préstamo, 7 días más, y solo si el préstamo está al día.
Es la feature que se usa en la actividad práctica de la clase para recorrer el flujo SDD completo.

## Supuestos

- Se mantiene el reloj como puerto (`Clock`). En pruebas se usa el reloj fijo `2026-03-02T12:00:00Z`.
- Los préstamos existentes parten con `renewalCount = 0` (la migración agrega la columna con ese valor por defecto).

## Reglas de negocio

- **RENEW-R1 · Extensión.** Renovar suma 7 días a `dueAt` (no a la hora actual) e incrementa `renewalCount` en 1.
- **RENEW-R2 · Una sola vez.** Un préstamo con `renewalCount = 1` no se puede renovar: 409 `RENEWAL_LIMIT_REACHED`.
- **RENEW-R3 · Solo al día.** Un préstamo `OVERDUE` no se puede renovar: 409 `LOAN_OVERDUE`. Un préstamo
  devuelto tampoco: 409 `ALREADY_RETURNED`. Renovar exactamente en el instante `dueAt` está permitido.
- **RENEW-R4 · Inexistente.** Un préstamo que no existe responde 404 `LOAN_NOT_FOUND`. Un `loanId` que no es UUID responde 400.

## Comportamiento en la interfaz

- **UI-RENEW-1** En "Mis préstamos", cada préstamo activo con `renewalCount = 0` muestra el botón "Renovar".
  Al renovar, la fecha de devolución se actualiza sin recargar y el botón desaparece.
- **UI-RENEW-2** Los errores se muestran como "Este préstamo ya fue renovado" y "No puedes renovar un préstamo vencido".

## Criterios de aceptación (mapa a los tests)

| Regla      | Capa y test que la verifica                                           |
| ---------- | --------------------------------------------------------------------- |
| RENEW-R1   | unit dominio `loan.spec.ts` · unit aplicación `renew-loan.spec.ts` · contrato (200) |
| RENEW-R2   | unit dominio `loan.spec.ts` · contrato (409)                          |
| RENEW-R3   | unit dominio `loan.spec.ts` (límite exacto en `dueAt`)                |
| RENEW-R4   | contrato (404 y 400)                                                  |
| UI-RENEW-1 | componentes `LoanList.test.tsx` · E2E `FLOW-PRE-04`                   |
| UI-RENEW-2 | componentes `LoanList.test.tsx`                                       |

Los tests nuevos **fallan** antes de implementar: ese es el contrato SDD.

## Fuera de alcance

- Más de una renovación o renovaciones configurables por tipo de libro.
- Bloquear la renovación si otra persona reservó el libro (no hay reservas todavía).
