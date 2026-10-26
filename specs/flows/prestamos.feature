# language: es
# Flujos de usuario de SPEC-LIB-02. playwright-bdd genera los tests de Playwright desde aquí.
# Reloj fijo de las pruebas: 2026-03-02T12:00:00Z (zona America/Santiago).
@SPEC-LIB-02
Característica: Préstamos
  Como estudiante de la UC
  quiero pedir libros prestados y devolverlos
  para leerlos en mi casa

  @FLOW-PRE-01 @smoke
  Escenario: Pedir prestado un libro disponible
    Dado que estoy en el catálogo
    Cuando pido prestado "Cien años de soledad" con el correo "ana@uc.cl"
    Entonces veo el mensaje "Préstamo registrado"
    Y veo la fecha de devolución "16-03-2026"

  @FLOW-PRE-02
  Escenario: Devolver un libro desde mis préstamos
    Dado que "ana@uc.cl" tiene prestado "Cien años de soledad"
    Cuando reviso los préstamos de "ana@uc.cl"
    Y devuelvo "Cien años de soledad"
    Entonces el préstamo de "Cien años de soledad" aparece como "Devuelto"

  @FLOW-PRE-03
  Escenario: No se puede superar el límite de préstamos
    Dado que "beto@uc.cl" tiene prestados "Cien años de soledad", "Ficciones" y "Desolación"
    Cuando pido prestado "Veinte poemas de amor y una canción desesperada" con el correo "beto@uc.cl"
    Entonces veo el error "Alcanzaste el máximo de 3 préstamos activos"
