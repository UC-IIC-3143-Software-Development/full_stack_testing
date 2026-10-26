# language: es
# Flujos de usuario de SPEC-LIB-01. playwright-bdd genera los tests de Playwright desde aquí.
@SPEC-LIB-01
Característica: Catálogo de libros
  Como estudiante de la UC
  quiero buscar libros en el catálogo
  para saber si puedo pedirlos prestados

  @FLOW-CAT-01 @smoke
  Escenario: Buscar un libro por autor sin tildes
    Dado que estoy en el catálogo
    Cuando busco "garcia marquez"
    Entonces veo el libro "Cien años de soledad"
    Y el libro "Cien años de soledad" aparece como "Disponible (3)"

  @FLOW-CAT-02
  Escenario: Un libro sin copias aparece agotado
    Dado que estoy en el catálogo
    Entonces el libro "La casa de los espíritus" aparece como "Agotado"
    Y no puedo pedir prestado "La casa de los espíritus"

  @FLOW-CAT-03
  Escenario: Agregar un libro nuevo
    Dado que estoy en el catálogo
    Cuando agrego el libro "Rayuela" de "Julio Cortázar" con ISBN "978-84-376-0494-7" y 2 copias
    Entonces veo el mensaje "Libro agregado"
    Y veo el libro "Rayuela"

  @FLOW-CAT-04
  Escenario: Un ISBN inválido se rechaza antes de enviar
    Dado que estoy en el catálogo
    Cuando agrego el libro "Libro falso" de "Nadie" con ISBN "978-0-00-000000-1" y 1 copias
    Entonces veo el error "El ISBN no es válido"
