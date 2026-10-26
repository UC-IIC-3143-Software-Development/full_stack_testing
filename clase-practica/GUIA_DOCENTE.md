# Clase práctica: Full Stack Testing moderno con IA
## Cómo evitar que la IA genere cientos de tests que no valen la pena

**Libro de referencia:** Gayathri Mohan, *Full Stack Testing: A Practical Guide for Delivering
High Quality Software in the Age of AI*, 2.ª ed., O'Reilly, 2026. Las páginas citadas son las del libro.

**Duración:** 3 h (al final hay una versión de 90 min).
**Material:** carpeta `lab/` (Node 22.12 o superior, recomendado 24, y `npm install`). Enunciado para estudiantes en `lab/README.md`.

### Objetivos de aprendizaje
Al terminar, cada estudiante puede:
1. Explicar por qué la cantidad de tests y la cobertura de líneas no miden la calidad de una suite.
2. Reconocer los antipatrones *cono de helado* y *cupcake* en una suite generada por IA.
3. Decidir en qué capa va cada test (micro/macro) y descartar los redundantes.
4. Usar mutation testing para medir si una suite detecta bugs.
5. Configurar barandas (instrucciones, skills, revisor, hook y CI) para que un agente de IA
   genere pocos tests, en la capa correcta y que sirvan.

---

## Agenda

| Min | Bloque | Formato |
|-----|--------|---------|
| 0 a 15 | Gancho: "74 tests, 96 % de cobertura… ¿cuántos sirven?" | Demo en vivo |
| 15 a 45 | Marco conceptual (libro, caps. 1, 3, 4 y 12) | Exposición + preguntas |
| 45 a 75 | **Lab 1:** diagnóstico | Parejas |
| 75 a 85 | Pausa | |
| 85 a 125 | **Lab 2:** poda | Parejas |
| 125 a 165 | **Lab 3:** IA con barandas | Parejas |
| 165 a 180 | Puesta en común y cierre | Plenario |

---

## 1. Gancho (15 min)

Ejecutar en vivo dentro de `lab/`:

```bash
npm test               # 74 passed
npm run test:coverage  # 96,3 % de líneas
```

Preguntar: *"¿Mergearían este PR?"* Casi todos van a decir que sí. Después:

```bash
npm run mutation       # mutation score 74 %, 30 mutantes sobreviven
```

Abrir `reports/mutation/index.html` y mostrar estos sobrevivientes. Son **bugs de negocio reales
que ninguno de los 74 tests detecta**:

| Mutante que sobrevive (`src/`) | Bug real que representa |
|---|---|
| `inventory.reserve(...)` eliminado (`app.js:35`) | El stock nunca se descuenta: se sobrevende |
| `stock - qty` → `stock + qty` (`inventory.js:9`) | Comprar **aumenta** el stock |
| `Array(i.qty)` → `Array()` (`app.js:36`) | Se cobra 1 unidad aunque se pidan 2 |
| `>= qty` → `> qty` (`inventory.js:6`) | No se puede comprar la última unidad (valor límite) |
| `orders.set(...)` eliminado (`app.js:38`) | Los pedidos no se guardan (sobrevive porque los GET dependen de POST de *otros* tests) |
| `{ errors }` → `{}` (`app.js:27`) | El cliente recibe 400 sin saber qué campo está mal |

Mostrar después la suite de referencia: **26 tests, 100 % de líneas, 88 % de mutation score**
(`npm run solucion:mutation`). Un tercio de los tests y más detección.

> Mensaje: la IA optimiza lo que le pides. "Máxima cobertura" produce cobertura, no detección.

---

## 2. Marco conceptual (30 min)

### 2.1 Shift-left y "la calidad es responsabilidad del equipo" (cap. 1, pp. 4 a 7)
- Las verificaciones se hacen en cada fase, no al final. La IA puede ser el **"cuarto amigo"**
  en el *three amigos* para proponer casos borde (p. 5).
- "Successful AI adoption is a systems problem, not a tools problem" (DORA 2025, citado en p. 15):
  si las prácticas del equipo son malas, la IA amplifica el problema. Una suite inflada es un
  ejemplo de eso.
- Cuatro categorías de herramientas según intervención humana: *AI-assisted, AI-powered,
  AI-driven, AI agents* (p. 14). Cuanto más autónomo es el agente, más importan las barandas.

### 2.2 Tipos de test micro y macro (cap. 3, Tabla 3-1, p. 72)

| Test | Micro/Macro | Alcance | Esfuerzo | Tiempo |
|---|---|---|---|---|
| Unit | Micro | Un método | Mínimo | Rápido |
| Integration | Micro | Dos componentes | Mínimo a moderado | Rápido |
| Contract | Micro | Contrato entre servicios | Moderado | Medio |
| Service (API) | Macro | Funcionalidad en la API | Moderado | Medio |
| UI | Macro | Recorrido web | Moderado | Lento |
| End to end | Macro | Recorrido completo + sistemas downstream | Máximo | Lento |

Las dos preguntas antes de agregar un test de UI (o cualquier test macro), p. 71:
1. ¿Cuál es el propósito de este test?
2. ¿Puedo lograr lo mismo con tests micro de una capa más baja?

Pirámide de Mike Cohn (p. 72): **10x unit : 5x service : x UI**. El caso real del libro:
200 tests de UI tardaban **8 horas** y fallaban por infraestructura (p. 66). Al rehacerlos según
la pirámide, **470 tests daban feedback en 35 minutos** (p. 73). Más tests, pero en la capa correcta.

### 2.3 Qué hace la IA cuando genera tests (evidencia del propio libro)
- **Generación de casos (p. 37):** con un prompt amplio, Claude devolvió **70 a 80 casos** para la
  home de Amazon: muchos duplicados o solapados, superficiales, y algunos inventaban lógica de
  dominio. Con un alcance acotado (solo la búsqueda) y contexto del proyecto, la calidad
  "mejoró diez veces" (p. 38).
- **Starter kit, no oráculo (p. 38):** los casos que genera un LLM son un *starter kit*: hay que
  validarlos rápido y usar el tiempo ahorrado en pensar casos más profundos.
- **Tests de API con un agente (p. 102):** Claude Code generó **30 tests REST Assured**. La mayoría
  eran validaciones de input que "no pertenecen a la capa de API, conviene que sean unit".
- **"Pasa" no es suficiente (p. 94):** el código generado puede romper tests existentes, usar
  locators inestables o **duplicar un test**: "another reason to generate one test at a time".
- **Flujos agénticos (p. 96):** "automated agentic workflows can easily lead you into antipatterns",
  por ejemplo poner todo como UI o duplicar tests entre unit, API y UI. Por eso el flujo tiene
  **dos pasos**: primero generar casos y después **elegir activamente** cuáles automatizar y en qué capa.
- **Conclusión del cap. 3 (p. 118):** las herramientas de IA "tend to generate tests in bulk that
  don't necessarily belong in a particular layer".

### 2.4 Antipatrones (pp. 114 a 116)
- **Cono de helado:** pirámide invertida, con muchos tests de UI y pocos micro. Síntoma temprano:
  aparecen defectos de regresión en el testing manual de la historia.
- **Cupcake:** el mismo test repetido en varias capas. "Using AI to increase test coverage quickly
  increases the possibility of this antipattern occurring" (p. 115). Para evitarlo: en el
  **story kickoff**, decidir quién escribe (o genera) qué test y en qué capa, y dejarlo
  documentado en la historia.

### 2.5 El mito del 100 % (pp. 116 a 117, 362)
- La cobertura de automatización o de código **no garantiza** una aplicación sin bugs: solo
  indica qué casos conocidos están automatizados.
- **Mutation testing** encuentra casos que faltan: muta el código y verifica que algún test falle.
  Es muy efectivo pero lento, "so use it wisely" (p. 116). En el lab se ejecuta solo sobre los
  archivos que cambió el PR.
- Métrica recomendada (p. 362): **cobertura ponderada por severidad y prioridad**. "Your teams can
  stockpile automated tests with AI tools quickly… you might have high coverage but get little value."

### 2.6 Características de un buen test (p. 107)
Legible (AAA), **un comportamiento por test**, independiente ("chained tests lead to chained
errors"), sin depender del entorno y ejecutable con un solo comando.

### 2.7 Cómo se gobierna la IA según el libro (pp. 90 a 97, 103, 365)
| Mecanismo | Uso en el libro | En el lab |
|---|---|---|
| Instrucciones de proyecto (MUST DO / AVOID) | `copilot-instructions.md`, p. 90: "Don't duplicate existing tests" | `CLAUDE.md` |
| Prompt files / flujo en 2 pasos | p. 92, p. 96 | skill `plan-de-tests` |
| Skills cortos y modulares | p. 95 a 96: las instrucciones largas se pasan por alto | `SKILL.md` de ~30 líneas |
| Agente revisor (LLM-as-judge) | p. 103: otro modelo, puntaje 0 a 1, umbral 0,7 | agente `revisor-de-tests` |
| Economía de tokens | p. 97: aprobar el plan antes de escribir código, modelo caro para planificar y barato para ejecutar | paso de aprobación del skill |
| Habilidad blanda: dividir en tareas | p. 365: "AIs do their best… as small executable tasks" | "un test a la vez" |

Lo que agrega el lab y no está en el libro: **barandas deterministas** (`test-budget`, hook `Stop`
y CI). Las instrucciones son pedidos que el modelo puede ignorar ("there is no guarantee that
Claude will always… abide by your guidelines", p. 44). Un script que falla, no.

---

## 3. Lab 1: Diagnóstico (30 min). Clave de respuestas

`npm run budget` sobre la suite de IA reporta: **pirámide invertida** (36 api vs. 38 unit, máximo 19),
**4 grupos de duplicados** (incluida una tabla de 20 sumas de la misma partición),
**10 aserciones débiles**, **2 patrones flaky** y **18 candidatos a bajar de capa**.

Clasificación esperada (para guiar la discusión, no hay una única respuesta correcta):

**`orders.unit.test.js` (38 tests)**

| Tests | Decisión | Por qué |
|---|---|---|
| `should be defined`, `should be a function`, `should return a value`, `should return a number` | Borrar | No detectan ningún bug: fallarían solo si el módulo no existe |
| Tabla de 20 sumas | Fusionar en 1 | Todas son la misma partición (enteros positivos) |
| Faltan: descuentos negativos, total que quedaría negativo, `0.1 + 0.2` | Agregar | Particiones reales del dominio (ver ejemplo del libro, p. 68) |
| `should calculate the total correctly` ×2 | Borrar | El oráculo recalcula la lógica con `reduce` (test tautológico) |
| `empty list` ×3 | Dejar 1 | Duplicados con títulos distintos (`budget` no los ve, el revisor LLM sí) |
| `should throw for invalid input` | Mantener y reforzar | Afirmar `TypeError` y sumar `NaN`/`Infinity` |
| `should not throw for valid input` | Borrar | Aserción débil, ya implícita en cualquier test positivo |
| `validateLine` valid ×3 | Dejar 1 | Misma partición |
| `should return errors…` ×2 | Reemplazar | Afirmar el **mensaje exacto** por cada partición inválida |

**`orders.api.test.js` (36 tests)**

| Tests | Decisión | Por qué |
|---|---|---|
| `create an order` ×5 + `body`/`id`/`total`/`JSON` | Fusionar en 1 flujo | Afirmar total, stock descontado y que el GET devuelve lo mismo. Mata 4 de los bugs del gancho |
| `respond in less than 200ms` | Borrar | Flaky. La performance se prueba con herramientas de carga (cap. 8) |
| `401` ×4 | Dejar 3 en tabla | Sin header, token inválido, esquema no Bearer. **El de header malformado encontró un bug real** al armar este lab: no hay que podar a ciegas |
| `400` ×16 por campo | Bajar a unit | Ya lo cubre `validateLine`. Dejar 1 test de API que verifique que los errores se propagan, más `items` vacío (esa regla vive en `app.js`) |
| `409` ×2 | Dejar 1 y reforzar | Verificar atomicidad: si un SKU falla, no se reserva nada. SKU desconocido es la misma partición (stock 0) |
| `GET order 1/2` | Borrar | Dependen del orden de ejecución. Además engañan a Stryker: el mutante `orders.set` sobrevive |
| `GET 404` | Mantener | |

Preguntas para el plenario:
- ¿Por qué el 96 % de cobertura convivía con bugs graves? (Se ejecuta la línea, pero nada la verifica.)
- Los mutantes de mensajes de error que sobreviven en la solución: ¿vale la pena matarlos?
  (Solo si un cliente consume ese mensaje. No hay que perseguir el 100 % de mutación.)
- `if (typeof price !== 'number' || …)` → `if (false || …)` sobrevive incluso en la solución. ¿Por qué?
  (Es un **mutante equivalente**: `Number.isFinite('10')` ya es `false`. Mutation testing también
  sirve para encontrar código redundante.)
- `orderTotal([5, -10])` debería dar 0, y la suite de IA no lo prueba, pero Stryker tampoco genera
  ese mutante. Conclusión: las herramientas no reemplazan el análisis exploratorio (cap. 2, y p. 38:
  los casos más profundos "still need human attention").

## 4. Lab 2: Poda (40 min)

Criterio de éxito: `npm run budget` en verde, menos tests y mayor mutation score que la suite de IA.
La referencia está en `lab/solucion/tests/` (26 tests). Conviene no mostrarla antes del final.

Regla que aparece sola en este lab (el script la exige): **en una tabla `it.each`, cada fila
debe nombrar una partición distinta**. Si no puedes ponerle un nombre diferente a la fila,
prueba lo mismo que otra.

## 5. Lab 3: IA con barandas (40 min)

Recorrido sugerido:
1. **Sin barandas** (rama aparte, sin `CLAUDE.md` ni `.claude/`): pedir "implementa la historia del
   código de descuento y genera tests exhaustivos". Lo esperable son decenas de tests, muchos en la
   capa API y con `budget` en rojo.
2. **Con barandas**: el agente debe presentar primero la tabla de plan y detenerse. La tarea de los
   estudiantes es **descartar casos** antes de aprobar.
3. El hook `Stop` (`.claude/settings.json` → `scripts/hook-budget.mjs`) no deja terminar al agente
   si `budget` falla y le devuelve el reporte para que se corrija solo.
4. Revisor LLM: `revisor-de-tests` encuentra lo que el script no ve (duplicados semánticos,
   reglas de negocio alucinadas).
5. CI (`.github/workflows/tests.yml`): loop rápido con `test` + `budget`, y mutation testing solo
   sobre los archivos de `src/` que cambió el PR (siguiendo la idea de dos loops del cap. 4, pp. 126 a 128).

Para quienes usan Copilot: el contenido de `CLAUDE.md` va en `.github/copilot-instructions.md`, y
el skill en `.github/skills/plan-de-tests/SKILL.md` (mismo formato, p. 95).

## 6. Cierre (15 min): 7 reglas para no inflar la suite con IA

1. **Alcance chico:** una historia o una función por pedido, nunca "todo el sistema" (p. 37).
2. **Dos pasos:** primero casos y capa, después código. Un humano aprueba y **descarta** (p. 96).
3. **La capa más baja posible**: validaciones en unit y, en API, contrato e integración (pp. 71, 102).
4. **Una partición, un test**: si no puedes nombrar el riesgo que cubre, no va.
5. **Un test a la vez**, revisado. Que pase no prueba que sirva (p. 94).
6. **Medir detección, no cantidad**: mutation testing sobre lo que cambió, y cobertura ponderada por severidad (pp. 116, 362).
7. **Barandas que fallan, no solo prompts**: script de presupuesto, hook y CI. Las instrucciones son el piso, no el techo.

Pregunta final: *"Si mañana la IA escribe 1.000 tests en un minuto, ¿cuál es el trabajo del tester?"*
Respuesta del libro: decidir qué probar y dónde, pensar los casos profundos y mantener la
estrategia de testing actualizada (cap. 12, primeros principios).

---

## Versión de 90 minutos
Gancho (10) → Marco conceptual comprimido: secciones 2.2, 2.3 y 2.4 (20) → Lab 1 solo con
`budget` + mutación y 3 mutantes (25) → Lab 3 solo con barandas, sin la comparación sin barandas (25) → Cierre (10).

## Problemas frecuentes
- `npm run solucion*` usa `SOLUCION=1 …`. En Windows sin WSL: `npx cross-env SOLUCION=1 vitest run`.
- Stryker tarda unos 10 s en este proyecto. Si una máquina es lenta: `npx stryker run --mutate src/inventory.js`.
- El hook necesita `git init` para detectar si cambiaron tests. Sin git, valida siempre.
