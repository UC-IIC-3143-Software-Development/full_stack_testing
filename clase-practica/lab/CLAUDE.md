# Política de tests de este repo

Esta política aplica a cualquier agente de IA (Claude Code, Copilot, Cursor…) que
escriba o modifique tests. Basada en *Full Stack Testing* (G. Mohan, 2.ª ed.), cap. 3.

## Antes de escribir un solo test
1. Usa el skill `plan-de-tests`: primero se listan los casos y la capa de cada uno,
   y **se espera la aprobación humana** del plan. No generes código de test sin plan aprobado.
2. Lee los tests existentes de la capa destino. Si un caso ya está cubierto, no lo repitas.

## Dónde va cada test (la capa más baja que pueda detectar el defecto)
| Qué se verifica                                     | Capa  | Archivo            |
|-----------------------------------------------------|-------|--------------------|
| Cálculos, reglas, validación de cada campo          | unit  | `*.unit.test.js`   |
| Contrato HTTP, auth, códigos de estado, integración | api   | `*.api.test.js`    |
| Flujos críticos de usuario de punta a punta         | e2e   | `*.e2e.test.js`    |

Antes de agregar un test de api o e2e responde: ¿cuál es su propósito? ¿se puede
lograr lo mismo con un test de una capa más baja? (libro, p. 71)

## Cada test debe
- Verificar **un** comportamiento, con patrón Arrange, Act, Assert.
- Tener un oráculo explícito (valor esperado literal). Nunca recalcular la lógica en el test.
- Ser independiente: estado nuevo en `beforeEach`, sin depender del orden de ejecución.
- Poder fallar: si borrar o mutar la línea que prueba no lo rompe, no sirve.
- En tablas `it.each`, cada fila nombra una **partición de equivalencia distinta**.

## Prohibido
- Aserciones débiles: `toBeDefined()`, `toBeTruthy()`, `not.toThrow()`, `typeof … 'function'`.
- Esperas o mediciones de tiempo (`Date.now()`, `setTimeout`, `waitForTimeout`).
- Repetir en api/e2e validaciones que ya cubre unit (antipatrón *cupcake*).
- Modificar o borrar tests existentes sin que el usuario lo pida.
- Generar tests en lote: escribe **uno a la vez**, ejecútalo y sigue.

## Definición de terminado
- `npm test` en verde.
- `npm run budget` en verde (pirámide, duplicados, aserciones débiles, flaky).
- Para código nuevo: los mutantes del archivo tocado mueren (`npx stryker run --mutate <archivo>`).
