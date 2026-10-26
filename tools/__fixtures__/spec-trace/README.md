# Fixtures de spec-trace

Mini repositorios sintéticos para probar `tools/spec-trace.mjs` sin depender de
`backend/` ni `frontend/`.

- `ok/`: todas las reglas y flujos tienen tests, ningún test es huérfano.
- `bad/`: una regla sin tests, un test huérfano, un ID inexistente, una regla sobre
  el presupuesto (un `it.each` de 7 filas) y un flujo con un paso sin implementar.
