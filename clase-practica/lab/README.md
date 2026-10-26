# Lab: testing full stack con IA sin inflar la suite

> Referencia: *Full Stack Testing*, 2.ª ed. (Gayathri Mohan, O'Reilly 2026), caps. 1 a 4 y 12.

Le pedimos a un agente de IA "tests exhaustivos con máxima cobertura" para una mini API
de pedidos. Entregó **74 tests en verde con 96 % de cobertura de líneas**.
Tu trabajo: averiguar cuántos valen la pena, podar la suite y ponerle barandas
para que la IA no vuelva a inflarla.

## Preparación (5 min)

```bash
git init && git add . && git commit -m "estado inicial"   # el hook usa git para ver cambios
npm install
npm test               # 74 tests en verde
```

Estructura:

```
src/                      API de pedidos (Express): orderTotal, validateLine, inventario
tests/ia-generada/        suite generada por IA (NO la corrijas en el Lab 1)
scripts/test-budget.mjs   presupuesto de tests: pirámide, duplicados, aserciones débiles, flaky
CLAUDE.md                 política de tests para agentes de IA
.claude/skills/           skill "plan-de-tests" (flujo de dos pasos con aprobación)
.claude/agents/           agente "revisor-de-tests" (LLM-as-judge)
.claude/settings.json     hook que no deja terminar al agente si excede el presupuesto
.github/workflows/        CI: build-and-test + budget + mutation testing incremental
```

---

## Lab 1: Diagnóstico (30 min)

**Pregunta guía:** ¿qué mide realmente cada métrica?

```bash
npm run test:coverage    # cobertura de líneas
npm run mutation         # mutation testing con Stryker → reports/mutation/index.html
npm run budget           # presupuesto de tests
```

Completa:

| Métrica                         | Valor |
|---------------------------------|-------|
| Cantidad de tests (unit / api)  |       |
| Cobertura de líneas             |       |
| Mutation score                  |       |
| Mutantes sobrevivientes         |       |
| Problemas que reporta `budget`  |       |

Abre el reporte HTML de mutación y elige **3 mutantes sobrevivientes**. Para cada uno:
¿qué bug real representa? ¿Por qué ninguno de los 74 tests lo detecta?

Después clasifica cada test de `tests/ia-generada/` con esta hoja:

| Test | ¿Qué bug detectaría? | ¿Capa correcta? | ¿Duplica a otro? | Decisión |
|------|----------------------|-----------------|------------------|----------|
|      |                      |                 |                  | mantener / bajar de capa / fusionar / borrar |

Las cinco preguntas para decidir si un test vale la pena:

1. **Detección:** si introduzco un bug realista en el código que prueba, ¿falla?
2. **Capa:** ¿es la capa más baja posible donde se puede detectar ese bug? (libro, p. 71)
3. **Redundancia:** ¿otro test ya cubre la misma partición de equivalencia?
4. **Comportamiento:** ¿verifica un resultado observable o solo que "algo existe"?
5. **Costo:** ¿cuánto tarda, cuánto se rompe por cambios ajenos, cuántos tokens cuesta mantenerlo?

## Lab 2: Poda (40 min)

Crea `tests/orders.unit.test.js`, `tests/inventory.unit.test.js` y `tests/orders.api.test.js`
aplicando tus decisiones. Luego borra `tests/ia-generada/`.

Meta:

- `npm run budget` en verde.
- **Menos tests** que la suite original y **mayor mutation score**.
- Encuentra al menos un bug real que la suite de IA sí detectaba y que no debes perder.

Pistas: valores límite (stock exacto), descuentos que dejan el total en negativo,
errores de punto flotante (`0.1 + 0.2`), atomicidad del pedido cuando un SKU no tiene stock,
tests que dependen del orden de ejecución.

Comparar con la referencia: `npm run solucion`, `npm run solucion:budget`, `npm run solucion:mutation`.

## Lab 3: IA con barandas (40 min)

Lee `CLAUDE.md`, `.claude/skills/plan-de-tests/SKILL.md` y `.claude/agents/revisor-de-tests.md`.

Nueva historia de usuario:

> **Código de descuento.** Como cliente quiero ingresar un código de descuento al crear el pedido
> para pagar menos.
> - `BIENVENIDA10` aplica 10 % sobre el total, con un tope de $50.
> - Un código inexistente devuelve 400 con el error `invalid discount code`.
> - El código es opcional y no distingue mayúsculas de minúsculas.
> - El total con descuento nunca es negativo y se redondea a 2 decimales.

1. **Sin barandas:** en una rama aparte, renombra `CLAUDE.md` y `.claude/`, y pídele al agente:
   *"Implementa la historia y genera tests exhaustivos"*. Anota: cantidad de tests, capas, `npm run budget`.
2. **Con barandas:** vuelve a la rama principal y pídele: *"Implementa la historia usando el skill plan-de-tests"*.
   Revisa el plan, **descarta casos** y apruébalo. Deja que implemente.
3. Ejecuta el agente `revisor-de-tests` sobre los tests nuevos.
4. Compara ambos intentos: tests, mutation score del archivo tocado, tiempo de ejecución y tokens/costo.

## Entregable

Una tabla comparativa (IA sin barandas / IA con barandas / tu poda manual) con:
tests por capa, cobertura, mutation score, problemas de `budget` y una conclusión de 5 líneas:
**¿qué barandas evitaron más tests inútiles?**
