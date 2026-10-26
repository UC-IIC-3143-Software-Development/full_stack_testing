# SPEC-<AREA>-<NN> · <Nombre de la feature>

| Campo              | Valor                                             |
| ------------------ | ------------------------------------------------- |
| ID                 | SPEC-<AREA>-<NN> · versión 1                      |
| Contrato API       | `specs/api/openapi.yaml` (operationId afectados)  |
| Flujos de usuario  | `specs/flows/<feature>.feature`                   |
| Depende de         | specs previas                                     |
| Specs por capa     | rutas de los `SPEC.md` de cada capa que cambia    |

## Contexto
Qué problema resuelve y para quién. Dos o tres párrafos, sin detalles de implementación.

## Supuestos
Lo que la feature puede dar por hecho (infraestructura, datos, otras features).

## Reglas de negocio
- **<ID>-R1 · Nombre corto.** Regla verificable, con valores concretos y el error que produce.

## Comportamiento en la interfaz
- **UI-<ID>-1** Qué ve y qué puede hacer la persona usuaria.

## Criterios de aceptación (mapa a los tests)
| Regla   | Capa y test que la verifica |
| ------- | --------------------------- |
| <ID>-R1 | unit dominio `archivo.spec.ts` · contrato (código HTTP) |

Los tests nuevos **fallan** antes de implementar: ese es el contrato SDD.

## Fuera de alcance
Lo que esta versión no hace (evita que una persona o un agente de IA agregue cosas no pedidas).
