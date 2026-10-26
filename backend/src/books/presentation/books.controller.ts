import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { CreateBook } from '../application/create-book'
import { GetBook } from '../application/get-book'
import { ListBooks } from '../application/list-books'
import { toBookResponse, type BookResponse, type NewBookRequest } from './book.dto'

/** Controller delgado: traduce HTTP a casos de uso. Sin reglas de negocio aquí. */
@Controller('books')
export class BooksController {
  constructor(
    private readonly createBook: CreateBook,
    private readonly listBooks: ListBooks,
    private readonly getBook: GetBook,
  ) {}

  /** operationId listBooks */
  @Get()
  async list(@Query('q') q?: string): Promise<BookResponse[]> {
    const books = await this.listBooks.execute(q)
    return books.map(toBookResponse)
  }

  /** operationId createBook */
  @Post()
  @HttpCode(201)
  async create(@Body() body: NewBookRequest): Promise<BookResponse> {
    return toBookResponse(await this.createBook.execute(body))
  }

  /** operationId getBook */
  @Get(':bookId')
  async findOne(@Param('bookId') bookId: string): Promise<BookResponse> {
    return toBookResponse(await this.getBook.execute(bookId))
  }
}
