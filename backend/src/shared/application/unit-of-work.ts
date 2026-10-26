/**
 * Puerto de unidad de trabajo: todo lo que pasa dentro de `run` se confirma o se
 * revierte junto. Con PostgreSQL es una transacción. En los tests unitarios es un
 * fake en memoria que también revierte si la función lanza un error.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>
}

export const UNIT_OF_WORK = Symbol('UnitOfWork')
