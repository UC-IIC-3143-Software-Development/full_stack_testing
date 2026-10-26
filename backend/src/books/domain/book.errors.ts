import { DomainError } from '../../shared/domain/domain-error'

/** BOOK-R2: ya existe un libro con ese ISBN normalizado. */
export class IsbnAlreadyExistsError extends DomainError {
  readonly code = 'ISBN_ALREADY_EXISTS'

  constructor(isbn: string) {
    super(`Ya existe un libro con el ISBN ${isbn}`)
  }
}

/** BOOK-R6 y LOAN-R7: el libro pedido no existe. */
export class BookNotFoundError extends DomainError {
  readonly code = 'BOOK_NOT_FOUND'

  constructor(readonly bookId: string) {
    super('No existe el libro solicitado')
  }
}

/** LOAN-R1: el libro no tiene copias disponibles. */
export class NoCopiesAvailableError extends DomainError {
  readonly code = 'NO_COPIES_AVAILABLE'

  constructor(readonly bookId: string) {
    super('No quedan copias disponibles de este libro')
  }
}
