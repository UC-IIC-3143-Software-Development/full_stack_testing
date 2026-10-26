# Constitución del proyecto

| Campo   | Valor                                      |
| ------- | ------------------------------------------ |
| ID      | SPEC-CONST-01 · versión 1                  |
| Alcance | Todo el monorepo (backend, frontend, CI)   |
| Dueños  | Equipo IIC3143                             |

Estos principios no se negocian. Cualquier spec, plan, test o línea de código
(escrita por una persona o por un agente de IA) debe respetarlos. Si un cambio
necesita romper un principio, primero se cambia esta constitución en un PR aparte.

## P1 · La spec manda (Spec Driven Development)

1. Ningún comportamiento nuevo se implementa sin una spec en `specs/` que lo describa.
2. El orden de trabajo es siempre: **spec → contrato (OpenAPI) → tests que fallan → código → tests verdes**.
3. Cada regla de negocio tiene un ID (por ejemplo `LOAN-R2`). Ese ID aparece en el
   título de al menos un test. El script `tools/spec-trace.mjs` lo verifica en CI.
4. Un test sin ID de regla o de flujo es un test huérfano y no se acepta. La única excepción son
   los tests de `tools/` (`tools/**/*.test.mjs`): verifican la infraestructura de CI y no reglas de
   negocio, así que no llevan ID y `spec-trace` no los cuenta.

## P2 · El contrato de la API es `specs/api/openapi.yaml`

1. Es la única fuente de verdad de la API. El backend lo implementa y el frontend
   genera sus tipos desde él (`openapi-typescript`).
2. Todo cambio de API parte modificando este archivo. CI detecta cambios que rompen
   compatibilidad (`oasdiff`) y estilo del contrato (`Spectral`).
3. Las respuestas reales del backend se validan contra el contrato en los tests de
   contrato. Los mocks del frontend (MSW) también se validan contra el contrato.

## P3 · Arquitectura en capas con dependencias hacia adentro

Ver `specs/architecture.md`. El dominio no conoce frameworks ni base de datos.
Las reglas de dependencia se verifican con `dependency-cruiser` en CI.

## P4 · Política de tests (cómo evitamos que la IA genere miles de tests inútiles)

1. **La capa más baja posible.** Cada test vive en la capa más baja que puede detectar
   el defecto. Las validaciones de campos se prueban en unit, no en API ni en UI.
2. **Una partición, un test.** Una regla se cubre con sus particiones de equivalencia y
   valores límite, no con variantes del mismo caso. Presupuesto máximo: 6 tests por regla y capa.
3. **Sin mocks por defecto.** Los tests unitarios usan objetos reales o *fakes*: versiones
   simples que funcionan de verdad, como un repositorio que guarda los datos en memoria o un reloj
   que siempre entrega la fecha que define el test (así el resultado no depende de la hora real).
   Un mock con `jest.fn()` solo se acepta para verificar una interacción con un sistema externo
   que no se puede simular de otra forma.
4. **Oráculos explícitos.** El valor esperado se escribe literal. Nunca se recalcula la
   lógica de producción dentro del test.
5. **Independencia.** Cada test prepara su propio estado y no depende del orden de ejecución.
6. **Prohibido:** aserciones débiles (`toBeDefined`, `toBeTruthy` sobre objetos), esperas fijas
   (`waitForTimeout`, `sleep`), tests duplicados entre capas (antipatrón *cupcake*).
7. **Calidad antes que cantidad.** El avance no se mide por el número de tests. Cada test nuevo
   cubre un flujo real de las personas usuarias o una regla de la spec, y debe poder fallar ante un
   error real. Vale igual para tests escritos por una persona o por un agente de IA.

## P5 · Seguridad desde el inicio (DevSecOps)

1. Ningún secreto en el repositorio (gitleaks y Trivy lo verifican).
2. Toda dependencia nueva pasa por el análisis de dependencias del PR.
3. Las imágenes de contenedor corren con usuario no root y se escanean con Trivy.
4. SAST (Semgrep, CodeQL) y DAST (OWASP ZAP) corren en cada PR.

## P6 · Todo cambio entra por Pull Request con evidencia

1. Trunk based development: ramas cortas (menos de 2 días) que se integran a `main`.
2. El pipeline publica en el PR la evidencia: capturas, videos de los flujos de usuario
   y el estado de cada endpoint.
3. `main` siempre está verde.

## Estilo de escritura

Español de Chile, tuteo. Sin guiones largos ni punto y coma en textos. Identificadores
de código en inglés, títulos de tests y textos de UI en español.
