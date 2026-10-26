/** Devuelve el error que lanza `action`. Falla si no lanza nada. */
export function thrownBy(action: () => unknown): unknown {
  try {
    action()
  } catch (error) {
    return error
  }
  throw new Error('Se esperaba un error y no se lanzó ninguno')
}

/** Devuelve el motivo del rechazo de `promise`. Falla si la promesa se cumple. */
export async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Se esperaba un rechazo y la promesa se cumplió')
}
