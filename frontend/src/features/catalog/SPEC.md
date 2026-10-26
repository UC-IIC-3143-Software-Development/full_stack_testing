# SPEC · catálogo (frontend) · capas components y hooks

| Campo        | Valor                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Capa         | `features/catalog/components` y `features/catalog/hooks` (ver `specs/architecture.md`) |
| Implementa   | UI-CAT-1 a UI-CAT-5 de SPEC-LIB-01 (la búsqueda BOOK-R5 la resuelve la API)            |
| Tipo de test | componentes con Vitest, Testing Library y MSW · flujos BDD · estilos · layout · visual |

## Responsabilidad

Mostrar el catálogo, buscar libros, ver el detalle de un libro y agregar libros nuevos.

## Puede depender de / no puede depender de

- Puede: `shared/domain` (ISBN), `shared/api` (solo desde hooks, los componentes solo importan tipos, ARCH-R7).
- No puede: llamar `fetch` directo (ARCH-R7), importar `mocks` (ARCH-R8), importar `next/navigation`
  en componentes que se prueban aislados (la navegación la decide la ruta, por ejemplo `onCreated`).

## Elementos

| Elemento                           | Propósito                                                 |
| ---------------------------------- | --------------------------------------------------------- |
| `hooks/useBooks.ts`                | `listBooks` con búsqueda                                  |
| `hooks/useBook.ts`                 | `getBook` con recarga silenciosa después de un préstamo   |
| `hooks/useCreateBook.ts`           | `createBook`                                              |
| `components/Catalog.tsx`           | buscador (`role="search"`) más la grilla                  |
| `components/BookList.tsx`          | grilla de tarjetas, estados de carga y error              |
| `components/BookCard.tsx`          | tarjeta `<article>` con insignia y botón "Pedir prestado" |
| `components/AvailabilityBadge.tsx` | insignia "Disponible (n)" o "Agotado"                     |
| `components/NewBookForm.tsx`       | formulario "Agregar libro"                                |
| `components/BookDetail.tsx`        | ficha del libro en `/libros/[id]`                         |

## Reglas que implementa

| Regla    | Dónde se implementa                                                       | Test                                                                                   |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| UI-CAT-1 | `BookCard`, `BookList` (ISBN con `formatIsbn`)                            | `BookCard.test.tsx`, `BookList.test.tsx`, `FLOW-CAT-01`, a11y                          |
| UI-CAT-2 | `AvailabilityBadge` con `--color-success` y `--color-danger`              | `BookCard.test.tsx` (texto), `catalog.style.spec.ts` (color), `catalog.visual.spec.ts` |
| UI-CAT-3 | `BookCard`: botón deshabilitado si no hay copias                          | `BookCard.test.tsx`, `FLOW-CAT-02`, `catalog.style.spec.ts`                            |
| UI-CAT-4 | `BookList.module.css` (grilla) y `BookCard.module.css` (insignia)         | `catalog.layout.spec.ts`, `catalog.visual.spec.ts`                                     |
| UI-CAT-5 | `NewBookForm`: valida BOOK-R1 antes de enviar y muestra errores por campo | `NewBookForm.test.tsx`, `FLOW-CAT-03`, `FLOW-CAT-04`                                   |
| UI-CAT-6 | `BookList`: aviso `role="alert"` si no puede cargar el catálogo           | `BookList.test.tsx`                                                                    |

## Cómo se prueba esta capa

- Componentes presentacionales (`BookCard`) con datos literales, sin red.
- Componentes con datos (`BookList`, `NewBookForm`) contra el mock server de Node (`src/mocks/node.ts`).
  Sin `vi.mock` ni `vi.fn`: la red es real y la responde MSW. Para un error puntual se usa `server.use()`.
- Lo que NO se prueba aquí: el color y la posición (jsdom no calcula CSS, lo hacen los proyectos
  `style` y `layout` de Playwright) ni las reglas del backend (BOOK-R2 a BOOK-R6 se prueban en el backend).
