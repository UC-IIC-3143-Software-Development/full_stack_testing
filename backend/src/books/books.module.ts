import { Module } from '@nestjs/common'
import { CLOCK, type Clock } from '../shared/application/clock'
import { BOOK_REPOSITORY, type BookRepository } from './application/book.repository'
import { CreateBook } from './application/create-book'
import { GetBook } from './application/get-book'
import { ListBooks } from './application/list-books'
import { TypeOrmBookRepository } from './infrastructure/typeorm-book.repository'
import { BooksController } from './presentation/books.controller'

/**
 * Composición del módulo: aquí (y solo aquí) se decide qué adaptador implementa cada puerto.
 * Los casos de uso son clases sin decoradores de Nest, por eso se crean con useFactory.
 */
@Module({
  controllers: [BooksController],
  providers: [
    { provide: BOOK_REPOSITORY, useClass: TypeOrmBookRepository },
    {
      provide: CreateBook,
      useFactory: (books: BookRepository, clock: Clock) => new CreateBook(books, clock),
      inject: [BOOK_REPOSITORY, CLOCK],
    },
    {
      provide: ListBooks,
      useFactory: (books: BookRepository) => new ListBooks(books),
      inject: [BOOK_REPOSITORY],
    },
    {
      provide: GetBook,
      useFactory: (books: BookRepository) => new GetBook(books),
      inject: [BOOK_REPOSITORY],
    },
  ],
  exports: [BOOK_REPOSITORY],
})
export class BooksModule {}
