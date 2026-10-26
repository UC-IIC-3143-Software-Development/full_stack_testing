## Qué cambia y por qué

<!-- Una o dos frases. Enlaza el issue si existe. -->

## Spec y reglas afectadas

- Spec: <!-- por ejemplo specs/features/SPEC-LIB-02-prestamos.md -->
- Reglas: <!-- por ejemplo LOAN-R2, UI-LOAN-4 -->
- Flujos: <!-- por ejemplo FLOW-PRE-03 -->
- ¿Cambia el contrato `specs/api/openapi.yaml`? <!-- sí o no. Si es sí, ¿rompe compatibilidad? -->

## Checklist de Spec Driven Development

- [ ] La spec existía o la actualicé en este PR ANTES de escribir código (P1)
- [ ] Si cambió la API, partí por `specs/api/openapi.yaml` y regeneré los tipos del frontend (`npm run api:generate`)
- [ ] Actualicé el `SPEC.md` de cada capa que toqué

## Checklist de tests (constitución P4)

- [ ] Cada test nuevo tiene el ID de su regla o flujo al inicio del título: `[LOAN-R2] ...`
- [ ] Cada caso está en la capa más baja que puede detectar el defecto
- [ ] Una partición, un test: sin variantes del mismo caso y como máximo 6 por regla y capa
- [ ] Sin mocks (`jest.fn`, `vi.fn`) salvo justificación escrita en el test
- [ ] Sin aserciones débiles (`toBeDefined`, `toBeTruthy` sobre objetos) ni esperas fijas
- [ ] Calidad antes que cantidad: cada prueba nueva cubre un flujo real o una regla de la spec
  (si la escribió una IA, la revisé con ese criterio)
- [ ] `npm run spec:trace` en la raíz queda en verde

## Seguridad (P5)

- [ ] No agregué secretos ni credenciales (ni siquiera de prueba fuera de `tools/__fixtures__`)
- [ ] Toda dependencia nueva es necesaria y la revisé en el resumen del job 4 · Dependencias (dependency review comenta en el PR solo si falla)

## Evidencia

El pipeline publica un comentario con capturas, GIF de los flujos y el estado de cada
endpoint. Revísalo antes de pedir revisión. Si cambiaste la interfaz, menciona qué capturas
mirar.
