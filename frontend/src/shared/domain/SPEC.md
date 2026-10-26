# SPEC · shared (frontend) · capa domain

| Campo        | Valor                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Capa         | `shared/domain` (ver `specs/architecture.md`)                                                                                      |
| Implementa   | BOOK-R1 (validación en el navegador), LOAN-R6 (cómo se muestra cada estado), UI-CAT-1 (formato ISBN), UI-LOAN-1 (formato de fecha) |
| Tipo de test | unit sin mocks · mutation testing con Stryker (nightly)                                                                            |

## Responsabilidad

Funciones puras que comparten los componentes y el mock server: ISBN, etiqueta y color de
cada estado de préstamo, y formato de fechas en hora de Chile.

## Puede depender de / no puede depender de

- Puede: solo TypeScript y las APIs estándar (`Intl`, `Date`).
- No puede: React, Next, `shared/api`, `features`, `mocks` ni ningún paquete npm (ARCH-R6).

## Elementos

| Archivo          | Propósito                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `isbn.ts`        | `normalizeIsbn`, `isValidIsbn13` (BOOK-R1), `formatIsbn` (máscara 3-2-3-4-1)                    |
| `loan-status.ts` | `presentLoanStatus`: etiqueta y token de color de cada estado (el estado lo calcula el backend) |
| `date-format.ts` | `formatDate`: ISO en UTC a `dd-mm-aaaa` en `America/Santiago`                                   |

## Reglas que implementa

| Regla     | Dónde se implementa | Test                                                                   |
| --------- | ------------------- | ---------------------------------------------------------------------- |
| BOOK-R1   | `isValidIsbn13`     | `isbn.test.ts` (6 particiones, presupuesto completo)                   |
| UI-CAT-1  | `formatIsbn`        | `isbn.test.ts`                                                         |
| LOAN-R6   | `presentLoanStatus` | `loan-status.test.ts` (los tres estados en un caso)                    |
| UI-LOAN-1 | `formatDate`        | `date-format.test.ts` (medianoche local, horario de verano e invierno) |

## Cómo se prueba esta capa

- Unit sin dobles: entradas literales, salidas literales (P4.4).
- El cálculo del estado (ACTIVE, OVERDUE, RETURNED) y su valor límite en `dueAt` se prueban en el
  backend, donde vive LOAN-R6. Repetirlos aquí sería el antipatrón cupcake (P4.6).
- Los tests corren con `TZ=UTC` para que el formato en hora de Chile se pruebe de verdad.
- `npm run test:mutation` muta este código y exige un puntaje mínimo de 70 %. Hoy queda sobre 95 %.
  Los mutantes que sobreviven son equivalentes (no cambian el comportamiento observable).
- Simplificación conocida: la máscara de `formatIsbn` es fija (la del ejemplo de la spec). La segmentación
  oficial depende de tablas de rangos de la Agencia ISBN y queda fuera de alcance.
