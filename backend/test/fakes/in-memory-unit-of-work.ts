import type { UnitOfWork } from '../../src/shared/application/unit-of-work'

/** Un store en memoria que sabe sacar una foto de su estado y volver a ella. */
export interface Snapshottable {
  snapshot(): unknown
  restore(snapshot: unknown): void
}

/**
 * Fake de UnitOfWork que se comporta como una transacción de verdad (un fake que no miente):
 * 1. ejecuta las unidades de trabajo de a una (como si hubiera locks), y
 * 2. si la función lanza un error, deja los stores como estaban (rollback).
 * No soporta transacciones anidadas: los casos de uso no las usan.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly stores: Snapshottable[]) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const snapshots = this.stores.map((store) => store.snapshot())
      try {
        return await work()
      } catch (error) {
        this.stores.forEach((store, index) => store.restore(snapshots[index]))
        throw error
      }
    })
    this.queue = result.catch(() => undefined)
    return result
  }
}
