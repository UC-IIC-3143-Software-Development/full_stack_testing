# Flujos de usuario

Los archivos `.feature` describen los flujos de usuario en Gherkin (en español).
Son parte de la spec: el frontend los convierte en tests de Playwright con
[playwright-bdd](https://vitalets.github.io/playwright-bdd/) (`npx bddgen`), así que
**escribir el flujo es escribir el test**. Los pasos se implementan una sola vez en
`frontend/tests/e2e/steps/`.

Cada escenario tiene un ID (`@FLOW-CAT-01`) que aparece en la evidencia del PR y un
tag `@smoke` si también se ejecuta contra el stack real (backend + PostgreSQL).

## Datos de prueba

El mock server (MSW) y la siembra del stack real usan estos libros:

| Título                                            | Autor                   | ISBN          | Copias totales | Disponibles |
| ------------------------------------------------- | ----------------------- | ------------- | -------------- | ----------- |
| Cien años de soledad                              | Gabriel García Márquez  | 9780307474728 | 3              | 3           |
| Desolación                                        | Gabriela Mistral        | 9789561112087 | 1              | 1           |
| Ficciones                                         | Jorge Luis Borges       | 9788445067314 | 2              | 1           |
| La casa de los espíritus                          | Isabel Allende          | 9780063376779 | 1              | 0           |
| Pedro Páramo                                      | Juan Rulfo              | 9786073105484 | 2              | 2           |
| Veinte poemas de amor y una canción desesperada   | Pablo Neruda            | 9789562390910 | 2              | 2           |

Reloj fijo: `2026-03-02T12:00:00Z`. Zona horaria: `America/Santiago`. Idioma: `es-CL`.

En el stack real no se puede crear un libro con 0 copias disponibles (BOOK-R4), por eso
los escenarios que dependen de "La casa de los espíritus" agotado no llevan `@smoke`.
