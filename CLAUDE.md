# Instrucciones para agentes de IA

Este repo se construye con Spec Driven Development. Antes de cambiar código:

1. Lee `specs/constitution.md` (principios y política de tests) y `specs/architecture.md` (capas).
2. Busca la spec de la feature en `specs/features/` y el `SPEC.md` de la capa que vas a tocar.
3. Si el cambio no está en una spec, **detente y propón la spec primero**. No inventes reglas.
4. Si cambia la API, modifica primero `specs/api/openapi.yaml` y regenera los tipos del
   frontend con `npm run api:generate` en `frontend/`.

## Tests
- Cada test nombra en su título el ID de la regla o del flujo que verifica: `[LOAN-R2] ...`.
- Escribe cada test en la capa más baja que pueda detectar el error. Por ejemplo, la validación
  de un campo se prueba en un test unitario, no en un test de la interfaz.
- Evita los mocks. Usa objetos reales o versiones simples en memoria (por ejemplo, un repositorio
  que guarda los datos en una lista). Si el resultado depende de la fecha u hora, el test define
  la fecha que usa el código en vez de leer la hora del computador, así siempre da el mismo resultado.
- **Calidad antes que cantidad.** No priorices el número de pruebas. Prioriza pruebas que cubran
  flujos reales de las personas usuarias y las reglas de la spec. Si una prueba no fallaría ante
  ningún error real, no aporta y no se agrega.
- Antes de terminar: `node tools/spec-trace.mjs` y los scripts `lint`, `typecheck`, `test:*` de la app tocada.

## Estilo
Español de Chile con tuteo en textos, specs, títulos de tests y UI. Sin guiones largos ni
punto y coma en textos. Código e identificadores en inglés. Prettier sin punto y coma.
