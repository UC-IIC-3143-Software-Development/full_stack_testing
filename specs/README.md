# Specs: la fuente de verdad del proyecto

Este proyecto usa **Spec Driven Development (SDD)**: primero se escribe la spec, después
el contrato, después los tests (que fallan) y al final el código.

```
 1. Spec de feature      specs/features/SPEC-LIB-XX.md      (reglas con ID: LOAN-R2)
 2. Contrato API         specs/api/openapi.yaml             (Spectral + oasdiff en CI)
 3. Flujos de usuario    specs/flows/*.feature              (playwright-bdd genera los E2E)
 4. Spec por capa        backend/src/<m>/<capa>/SPEC.md     (qué vive en cada capa)
 5. Tests que fallan     títulos con el ID: "[LOAN-R2] ..."  (tools/spec-trace.mjs los cruza)
 6. Código               hasta que todo queda verde
```

| Archivo                          | Qué define                                              |
| -------------------------------- | ------------------------------------------------------- |
| `constitution.md`                | Principios no negociables, incluida la política de tests |
| `architecture.md`                | Capas, reglas de dependencia, scripts y variables        |
| `api/openapi.yaml`               | Contrato de la API                                       |
| `features/SPEC-LIB-01-catalogo.md` | Catálogo de libros                                     |
| `features/SPEC-LIB-02-prestamos.md` | Préstamos                                             |
| `features/SPEC-LIB-03-renovacion.md` | Renovar préstamo (feature del PR de ejemplo)        |
| `flows/*.feature`                | Flujos de usuario ejecutables                            |
| `templates/`                     | Plantillas para nuevas specs de feature y de capa        |

## Trazabilidad

`node tools/spec-trace.mjs` lista cada regla (`BOOK-R1`, `LOAN-R3`, `UI-CAT-2`, `FLOW-PRE-01`...)
y los tests que la nombran. Falla si una regla no tiene tests, si un test no nombra ninguna
regla (test huérfano) o si una regla supera el presupuesto de tests por capa.
