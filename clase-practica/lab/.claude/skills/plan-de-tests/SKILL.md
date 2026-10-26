---
name: plan-de-tests
description: Planifica qué tests agregar para una historia de usuario o cambio de código ANTES de escribirlos. Usar siempre que se pida generar, agregar o ampliar tests.
---

# Plan de tests (dos pasos, con aprobación humana)

## Paso 1: casos de prueba (sin código)
1. Lee la historia o el diff y los criterios de aceptación.
2. Lista casos en formato Given/When/Then agrupados por **partición de equivalencia**
   y **valores límite**. Una partición = un caso. No enumeres variantes de la misma partición.
3. Incluye casos de error y, si aplica, requisitos cross-funcionales (seguridad, performance).

## Paso 2: asignación de capa y presupuesto
Para cada caso completa esta tabla y **detente a pedir aprobación**:

| # | Caso | Riesgo que cubre | Capa (unit/api/e2e) | ¿Ya cubierto por? | Decisión |
|---|------|------------------|---------------------|-------------------|----------|

Reglas:
- Elige la capa más baja que detecte el defecto. Validaciones de campos → unit.
- Si "¿Ya cubierto por?" tiene un test existente → Decisión = **descartar**.
- Si no puedes nombrar el riesgo concreto (qué bug detectaría) → **descartar**.
- Reporta el total por capa y verifica que respete `test-budget.config.json`
  (api ≤ 0,5 × unit y e2e ≤ 0,1 × unit).

## Paso 3: implementación (solo con el plan aprobado)
- Un test a la vez: escribir → `npm test` → siguiente.
- Al final: `npm run budget` y `npx stryker run --mutate <archivo de producción tocado>`.
- Si sobreviven mutantes relevantes, agrega el caso que falta. Si son irrelevantes
  (p. ej. el texto exacto de un mensaje de error que nadie consume), explícalo y no
  agregues tests solo para matarlos.
