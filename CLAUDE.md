# Instrucciones para agentes de IA

Este repo se construye con Spec Driven Development. Antes de cambiar código:

1. Lee `specs/constitution.md` (principios y política de tests) y `specs/architecture.md` (capas).
2. Busca la spec de la feature en `specs/features/` y el `SPEC.md` de la capa que vas a tocar.
3. Si el cambio no está en una spec, **detente y propón la spec primero**. No inventes reglas.
4. Si cambia la API, modifica primero `specs/api/openapi.yaml` y regenera los tipos del
   frontend con `npm run api:generate` en `frontend/`.

## Tests
- Cada test nombra el ID de la regla o flujo que verifica en su título: `[LOAN-R2] ...`.
- Capa más baja posible. Sin mocks salvo justificación (usa fakes en memoria y reloj fijo).
- No generes tests en lote. Propón la lista de casos (regla, capa, partición) y espera aprobación.
- Antes de terminar: `node tools/spec-trace.mjs` y los scripts `lint`, `typecheck`, `test:*` de la app tocada.

## Estilo
Español de Chile con tuteo en textos, specs, títulos de tests y UI. Sin guiones largos ni
punto y coma en textos. Código e identificadores en inglés. Prettier sin punto y coma.
