/** Puerto: comprueba que la base de datos responde. */
export interface DatabaseProbe {
  ping(): Promise<void>
}

export const DATABASE_PROBE = Symbol('DatabaseProbe')
