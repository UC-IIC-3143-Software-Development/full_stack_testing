import { DomainValidationError } from '../../shared/domain/domain-error'
import { lengthInCodePoints, normalizeForSearch } from '../../shared/domain/text'
import { NoCopiesAvailableError } from './book.errors'
import { Isbn } from './isbn'

export const TITLE_MAX_LENGTH = 200
export const AUTHOR_MAX_LENGTH = 120
export const MIN_COPIES = 1
export const MAX_COPIES = 50

export interface BookProps {
  id: string
  isbn: Isbn
  title: string
  author: string
  totalCopies: number
  availableCopies: number
  createdAt: Date
}

export interface NewBookInput {
  id: string
  isbn: string
  title: string
  author: string
  totalCopies: number
  now: Date
}

/**
 * Entidad Book. Inmutable: cada operación devuelve un Book nuevo.
 * Invariante (BOOK-R4): 0 <= availableCopies <= totalCopies.
 */
export class Book {
  private constructor(private readonly props: BookProps) {}

  /** Crea un libro nuevo validando BOOK-R1, BOOK-R3 y BOOK-R4. */
  static create(input: NewBookInput): Book {
    const isbn = Isbn.create(input.isbn)
    const title = requireText('title', 'El título', input.title, TITLE_MAX_LENGTH)
    const author = requireText('author', 'El autor', input.author, AUTHOR_MAX_LENGTH)
    if (
      !Number.isInteger(input.totalCopies) ||
      input.totalCopies < MIN_COPIES ||
      input.totalCopies > MAX_COPIES
    ) {
      throw new DomainValidationError(
        'totalCopies',
        `La cantidad de copias debe ser un entero entre ${MIN_COPIES} y ${MAX_COPIES}`,
      )
    }
    return new Book({
      id: input.id,
      isbn,
      title,
      author,
      totalCopies: input.totalCopies,
      availableCopies: input.totalCopies,
      createdAt: input.now,
    })
  }

  /** Reconstruye un libro ya guardado (lo usan los repositorios). */
  static restore(props: BookProps): Book {
    return new Book({ ...props })
  }

  get id(): string {
    return this.props.id
  }
  get isbn(): Isbn {
    return this.props.isbn
  }
  get title(): string {
    return this.props.title
  }
  get author(): string {
    return this.props.author
  }
  get totalCopies(): number {
    return this.props.totalCopies
  }
  get availableCopies(): number {
    return this.props.availableCopies
  }
  get createdAt(): Date {
    return this.props.createdAt
  }

  /** Clave de búsqueda sin tildes ni mayúsculas (BOOK-R5). */
  get searchKey(): string {
    return normalizeForSearch(`${this.props.title} ${this.props.author}`)
  }

  /** Clave para ordenar por título sin que importen mayúsculas ni tildes (BOOK-R5). */
  get titleKey(): string {
    return normalizeForSearch(this.props.title)
  }

  /** LOAN-R1: prestar descuenta una copia. Sin copias, NoCopiesAvailableError. */
  lendCopy(): Book {
    if (this.props.availableCopies === 0) {
      throw new NoCopiesAvailableError(this.props.id)
    }
    return new Book({ ...this.props, availableCopies: this.props.availableCopies - 1 })
  }
}

/** BOOK-R3: se recorta y no puede quedar vacío ni superar el máximo. */
function requireText(field: string, label: string, raw: string, maxLength: number): string {
  const value = raw.trim()
  if (value.length === 0) {
    throw new DomainValidationError(field, `${label} no puede estar vacío`)
  }
  if (lengthInCodePoints(value) > maxLength) {
    throw new DomainValidationError(
      field,
      `${label} puede tener como máximo ${maxLength} caracteres`,
    )
  }
  return value
}
