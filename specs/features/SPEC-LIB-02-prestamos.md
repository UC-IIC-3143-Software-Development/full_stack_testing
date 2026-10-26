# SPEC-LIB-02 · Préstamos

| Campo              | Valor                                                            |
| ------------------ | ---------------------------------------------------------------- |
| ID                 | SPEC-LIB-02 · versión 1                                          |
| Contrato API       | `specs/api/openapi.yaml` (`createLoan`, `listLoans`, `returnLoan`) |
| Flujos de usuario  | `specs/flows/prestamos.feature`                                  |
| Depende de         | SPEC-LIB-01                                                      |
| Specs por capa     | `backend/src/loans/*/SPEC.md`, `frontend/src/features/loans/SPEC.md` |

## Contexto

Con el catálogo listo, la biblioteca quiere registrar préstamos: una persona pide un libro
con su correo, se lo lleva por 14 días y luego lo devuelve. El sistema debe evitar prestar
copias que no existen y limitar cuántos libros puede tener una persona al mismo tiempo.

## Supuestos

- La persona se identifica solo por su correo. No hay cuentas de usuario en esta versión.
- La hora actual viene de un puerto `Clock`. En pruebas se usa un reloj fijo, nunca `Date.now()` directo.
- Las fechas se guardan en UTC. La interfaz las muestra en formato `dd-mm-aaaa` (Chile).

## Reglas de negocio

- **LOAN-R1 · Copias disponibles.** Solo se presta si `availableCopies > 0`. Al prestar,
  `availableCopies` baja en 1. Si no hay copias: 409 `NO_COPIES_AVAILABLE`.
  Dos solicitudes simultáneas por la última copia: exactamente una tiene éxito
  (se garantiza en la base de datos con una actualización condicional dentro de una transacción).
- **LOAN-R2 · Límite por persona.** Una persona puede tener como máximo 3 préstamos no
  devueltos (activos o vencidos). El cuarto responde 409 `LOAN_LIMIT_REACHED`.
- **LOAN-R3 · Fecha de devolución.** `dueAt = loanedAt + 14 días`.
- **LOAN-R4 · Sin duplicados.** Una persona no puede tener dos préstamos no devueltos del
  mismo libro: 409 `DUPLICATE_LOAN`.
- **LOAN-R5 · Devolución.** Devolver registra `returnedAt` con la hora actual y sube
  `availableCopies` en 1. Devolver un préstamo ya devuelto responde 409 `ALREADY_RETURNED`.
  Un préstamo inexistente responde 404 `LOAN_NOT_FOUND`.
- **LOAN-R6 · Estado.** `RETURNED` si tiene `returnedAt`. Si no, `OVERDUE` cuando la hora
  actual es posterior a `dueAt`, y `ACTIVE` en otro caso. El estado se calcula, no se guarda.
- **LOAN-R7 · Correo.** El correo se normaliza a minúsculas y sin espacios. Debe ser un correo
  válido. Libro inexistente al prestar: 404 `BOOK_NOT_FOUND`.

- **Orden de validación al prestar.** Si una solicitud incumple varias reglas, responde el primer
  error de esta lista: correo inválido (400), libro inexistente (404), `DUPLICATE_LOAN` (LOAN-R4),
  `LOAN_LIMIT_REACHED` (LOAN-R2) y `NO_COPIES_AVAILABLE` (LOAN-R1). Backend y mock server usan el mismo orden.
- **Correo con espacios por HTTP.** El contrato declara `format: email`, así que un correo con espacios
  se rechaza con 400 antes de llegar al dominio. La normalización de LOAN-R7 se prueba en la capa de dominio.

## Comportamiento en la interfaz

- **UI-LOAN-1** En el detalle del libro, el formulario "Pedir prestado" pide el correo y, al
  confirmar, muestra "Préstamo registrado" y la fecha de devolución en formato `dd-mm-aaaa`.
- **UI-LOAN-2** La página "Mis préstamos" busca por correo y lista los préstamos con una
  etiqueta de estado: "Activo" (azul `--color-info` #1D4ED8), "Vencido" (rojo `--color-danger`
  #B42318) y "Devuelto" (gris `--color-muted` #475467).
- **UI-LOAN-3** Cada préstamo no devuelto tiene un botón "Devolver". Al devolver, la etiqueta
  cambia a "Devuelto" sin recargar la página.
- **UI-LOAN-4** Los errores 409 se muestran con mensajes en español:
  `LOAN_LIMIT_REACHED` → "Alcanzaste el máximo de 3 préstamos activos",
  `NO_COPIES_AVAILABLE` → "No quedan copias disponibles",
  `DUPLICATE_LOAN` → "Ya tienes este libro prestado".

## Criterios de aceptación (mapa a los tests)

| Regla     | Capa y test que la verifica                                                    |
| --------- | ------------------------------------------------------------------------------ |
| LOAN-R1   | unit dominio `book.spec.ts` (copias) · unit aplicación `create-loan.spec.ts` · integración `loan.repository.int-spec.ts` (concurrencia) · contrato (409) |
| LOAN-R2   | unit dominio `loan-policy.spec.ts` · contrato (409)                            |
| LOAN-R3   | unit dominio `loan.spec.ts`                                                    |
| LOAN-R4   | unit dominio `loan-policy.spec.ts`                                             |
| LOAN-R5   | unit dominio `loan.spec.ts` · unit aplicación `return-loan.spec.ts` · contrato (200, 404, 409) |
| LOAN-R6   | unit dominio `loan.spec.ts` (límite exacto de `dueAt`) · unit frontend `loan-status.test.ts` |
| LOAN-R7   | unit dominio `email.spec.ts` · contrato (400 y 404)                            |
| UI-LOAN-1 | E2E `FLOW-PRE-01`                                                              |
| UI-LOAN-2 | componentes `LoanList.test.tsx` · estilos `loans.style.spec.ts`                |
| UI-LOAN-3 | E2E `FLOW-PRE-02`                                                              |
| UI-LOAN-4 | componentes `BorrowForm.test.tsx` · E2E `FLOW-PRE-03`                          |

## Fuera de alcance

- Renovar préstamos (se agrega en SPEC-LIB-03, ver la actividad práctica de la clase).
- Multas, reservas y notificaciones por correo.
- Autenticación de la persona.
