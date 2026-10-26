# language: es
@SPEC-CAT-01
Característica: Catálogo
  Como estudiante
  quiero buscar libros

  Antecedentes:
    Dado que estoy en el catálogo

  @FLOW-CAT-01 @smoke
  Escenario: Buscar un libro
    Cuando busco "garcia"
    Entonces veo 1 libro

  @FLOW-CAT-02
  Esquema del escenario: Buscar por autor
    Cuando busco "<autor>"
    Entonces veo <cantidad> libros

    Ejemplos:
      | autor   | cantidad |
      | borges  | 2        |
