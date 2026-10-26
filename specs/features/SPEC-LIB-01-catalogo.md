# SPEC-LIB-01 · Catálogo de libros

| Campo              | Valor                                                          |
| ------------------ | -------------------------------------------------------------- |
| ID                 | SPEC-LIB-01 · versión 1                                        |
| Contrato API       | `specs/api/openapi.yaml` (`listBooks`, `createBook`, `getBook`) |
| Flujos de usuario  | `specs/flows/catalogo.feature`                                 |
| Specs por capa     | `backend/src/books/*/SPEC.md`, `frontend/src/features/catalog/SPEC.md` |

## Contexto

La Biblioteca UC necesita un catálogo donde cualquier estudiante pueda buscar libros
y ver si hay copias disponibles, y donde el personal pueda agregar libros nuevos.
Es la primera feature del proyecto y sirve de base para los préstamos (SPEC-LIB-02).

## Supuestos

- No hay autenticación en esta versión. Cualquiera puede agregar libros (se agrega en otra spec).
- Un libro se identifica por su ISBN-13. No se manejan ediciones ni ISBN-10.
- El catálogo es pequeño (menos de 10.000 libros). No se pagina en esta versión.

## Reglas de negocio

- **BOOK-R1 · ISBN-13 válido.** El ISBN se normaliza quitando guiones y espacios. Debe tener
  13 dígitos, empezar con 978 o 979 y su dígito verificador debe ser correcto
  (pesos 1 y 3 alternados, módulo 10). Si no, error `VALIDATION_ERROR` en el campo `isbn`
  con el mensaje "El ISBN no es válido".
- **BOOK-R2 · ISBN único.** No pueden existir dos libros con el mismo ISBN normalizado.
  El segundo intento responde 409 `ISBN_ALREADY_EXISTS`. La base de datos también lo
  garantiza con un índice único.
- **BOOK-R3 · Título y autor.** Se guardan sin espacios al inicio ni al final. Título de 1 a
  200 caracteres y autor de 1 a 120 después de recortar. Vacío después de recortar es inválido.
- **BOOK-R4 · Copias.** `totalCopies` es un entero entre 1 y 50. Al crear un libro,
  `availableCopies` es igual a `totalCopies`. En la base de datos se cumple siempre
  `0 <= availableCopies <= totalCopies` (restricción `CHECK`).
- **BOOK-R5 · Búsqueda.** `q` filtra por título o autor, sin distinguir mayúsculas ni tildes
  ("garcia" encuentra "García Márquez"). Sin `q` se listan todos. Siempre ordenado por título.
- **BOOK-R6 · Libro inexistente.** Pedir un libro que no existe responde 404 `BOOK_NOT_FOUND`.
  Un `bookId` que no es UUID responde 400.

## Comportamiento en la interfaz

- **UI-CAT-1** El catálogo muestra una tarjeta por libro con título, autor e ISBN con guiones.
- **UI-CAT-2** La insignia de disponibilidad es verde con el texto "Disponible (n)" si hay
  copias y roja con el texto "Agotado" si no hay. Los colores salen de los tokens de diseño
  `--color-success` (#1E7F3C) y `--color-danger` (#B42318).
- **UI-CAT-3** El botón "Pedir prestado" está deshabilitado cuando el libro está agotado.
- **UI-CAT-4** En escritorio (1280 px) las tarjetas forman una grilla de 3 columnas. En móvil
  (390 px) forman una sola columna. La insignia queda en la esquina superior derecha de la tarjeta.
- **UI-CAT-5** El formulario "Agregar libro" valida el ISBN en el navegador antes de enviar
  y muestra los errores del servidor junto al campo correspondiente.
- **UI-CAT-6** Si el catálogo no se puede cargar (falla la red o la API), se muestra una alerta
  (`role="alert"`) con el texto "No pudimos cargar el catálogo. Intenta de nuevo en unos minutos."
- **UI-CAT-7** Junto al botón "Buscar" hay una casilla con el texto "Solo disponibles", desmarcada
  al entrar. Al marcarla se ocultan los libros agotados (0 copias disponibles) y se siguen viendo
  los que tienen 1 copia o más. El filtro se aplica en el navegador sobre la lista que ya entregó
  `listBooks`, sin otra solicitud a la API y sin cambiar el contrato. Se combina con la búsqueda:
  filtra los resultados de la búsqueda actual y se mantiene al buscar otra vez. Si la búsqueda
  tiene resultados pero ninguno está disponible, se muestra el mensaje "No hay libros disponibles
  para tu búsqueda. Desmarca “Solo disponibles” para ver los agotados." La casilla tiene su
  label asociado y muestra el foco al navegar con teclado.

## Criterios de aceptación (mapa a los tests)

| Regla    | Capa y test que la verifica                                                     |
| -------- | ------------------------------------------------------------------------------- |
| BOOK-R1  | unit dominio `isbn.spec.ts` · unit frontend `isbn.test.ts` · contrato `books.contract.spec.ts` (400) |
| BOOK-R2  | unit aplicación `create-book.spec.ts` · integración `book.repository.int-spec.ts` (índice único) · contrato (409) |
| BOOK-R3  | unit dominio `book.spec.ts`                                                     |
| BOOK-R4  | unit dominio `book.spec.ts` · integración (restricción `CHECK`)                 |
| BOOK-R5  | integración `book.repository.int-spec.ts` · contrato (`listBooks`)              |
| BOOK-R6  | contrato (`getBook` 404 y 400)                                                  |
| UI-CAT-1 a UI-CAT-3 | componentes `BookCard.test.tsx` · E2E `FLOW-CAT-01`, `FLOW-CAT-02` · estilos `catalog.style.spec.ts` |
| UI-CAT-4 | layout `catalog.layout.spec.ts` · visual `catalog.visual.spec.ts`               |
| UI-CAT-5 | componentes `NewBookForm.test.tsx` · E2E `FLOW-CAT-03`, `FLOW-CAT-04`           |
| UI-CAT-6 | componentes `BookList.test.tsx`                                                 |
| UI-CAT-7 | componentes `Catalog.test.tsx` · E2E `FLOW-CAT-05` · layout y estilos (foco) `catalog.*.spec.ts` · visual `catalog.visual.spec.ts` |

Cada test incluye el ID de la regla en su título, por ejemplo
`it('[BOOK-R1] rechaza un ISBN con dígito verificador incorrecto', ...)`.

## Fuera de alcance

- Editar o eliminar libros.
- Portadas, categorías o ediciones.
- Paginación y búsqueda por ISBN parcial.
