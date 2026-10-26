# SPEC-CAT-01 · Catálogo (fixture)

| Campo | Valor                   |
| ----- | ----------------------- |
| ID    | SPEC-CAT-01 · versión 1 |

## Reglas de negocio

- **CAT-R1 · ISBN válido.** El ISBN tiene 13 dígitos.
- **CAT-R2 · Búsqueda.** Busca sin tildes.

## Comportamiento en la interfaz

- **UI-CAT-1** La tarjeta muestra el título.

| Regla  | Test                |
| ------ | ------------------- |
| CAT-R1 | unit `isbn.spec.ts` |
