# SPEC · <módulo> · capa <domain | application | infrastructure | presentation>

| Campo        | Valor                                       |
| ------------ | ------------------------------------------- |
| Capa         | <capa> (ver `specs/architecture.md`)        |
| Implementa   | reglas de SPEC-LIB-XX que viven en esta capa |
| Tipo de test | unit sin mocks · integración · contrato     |

## Responsabilidad
Qué hace esta capa en este módulo, en una frase.

## Puede depender de / no puede depender de
Lista explícita (la verifica dependency-cruiser).

## Elementos
Clases, funciones o archivos y su propósito.

## Reglas que implementa
| Regla | Dónde se implementa | Test |
| ----- | ------------------- | ---- |

## Cómo se prueba esta capa
Tipo de test, dobles permitidos (fakes en memoria, fecha fija de prueba) y lo que NO se prueba aquí
porque pertenece a otra capa.
