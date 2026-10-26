# SPEC · mock server (frontend) · capa mocks

| Campo        | Valor                                                                |
| ------------ | -------------------------------------------------------------------- |
| Capa         | `mocks` (ver `specs/architecture.md`)                                |
| Implementa   | Todas las operaciones de `specs/api/openapi.yaml` con reglas mínimas |
| Tipo de test | contrato de mocks (`npm run test:contract`)                          |

## Responsabilidad

Simular la API con MSW para probar el frontend sin backend: en Vitest (Node) y en el navegador
(Service Worker, para Playwright y para `npm run dev:mock`).

## Puede depender de / no puede depender de

- Puede: `msw`, `shared/domain` (reglas puras como ISBN y estado de préstamo) y los tipos de `shared/api`.
- No puede: ser importado por `app`, `features` ni `shared` (ARCH-R8). Solo lo cargan los tests y
  `providers/ApiMockingProvider.tsx` cuando `NEXT_PUBLIC_API_MOCKING=enabled`.

## Elementos

| Archivo                     | Propósito                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `loan-status.ts`            | Versión mínima de LOAN-R6 para devolver estados realistas (la regla real vive en el backend) |
| `fixtures.ts`               | Libros de `specs/flows/README.md`, reloj fijo y préstamos de `carla@uc.cl`                   |
| `db.ts`                     | "Base de datos" fake: en memoria (Node) o en `sessionStorage` (navegador)                    |
| `handlers.ts`               | Un handler por operación del contrato, con errores `application/problem+json`                |
| `browser.ts` / `node.ts`    | `setupWorker` y `setupServer` con los mismos handlers                                        |
| `handlers.contract.test.ts` | Valida cada respuesta contra el contrato con Ajv (JSON Schema 2020-12)                       |

## Reglas que implementa

- **MOCK-R1 · Cobertura del contrato.** Hay un handler para cada operación de `openapi.yaml` y los
  casos de `handlers.contract.test.ts` ejercitan cada status documentado de cada operación.
- **MOCK-R2 · Respuestas válidas.** Cada respuesta del mock (éxito y error) cumple el schema, el
  status y el media type (`application/json` o `application/problem+json`) del contrato.

| Regla   | Dónde se implementa                      | Test                                                                                             |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| MOCK-R1 | `handlers.ts` (un handler por operación) | `handlers.contract.test.ts` (2 tests de cobertura)                                               |
| MOCK-R2 | `handlers.ts` y `problem()`              | `handlers.contract.test.ts` (21 casos, cada uno con el ID de la regla de negocio que representa) |

Reglas de negocio mínimas que simula (para que los flujos sean realistas, no para probarlas aquí):
BOOK-R1, BOOK-R2, BOOK-R3, BOOK-R4, BOOK-R5, BOOK-R6, LOAN-R1, LOAN-R2, LOAN-R3, LOAN-R4, LOAN-R5,
LOAN-R6 y LOAN-R7. Cuando hay varios conflictos a la vez, el orden es: duplicado (LOAN-R4), límite
(LOAN-R2) y copias (LOAN-R1).

## Cómo se prueba esta capa

- Es el lado consumidor del contrato bidireccional. El backend valida el lado proveedor con supertest.
- Si alguien cambia `openapi.yaml` y el mock queda desactualizado, `test:contract` falla antes de que
  los tests de componentes pasen contra una API que no existe.
- Lo que NO se prueba aquí: que las reglas de negocio sean correctas. Eso es responsabilidad del backend.
