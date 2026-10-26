/** Detiene el contenedor. Si el proceso muere antes, Ryuk (de Testcontainers) lo elimina igual. */
export default async function globalTeardown(): Promise<void> {
  await globalThis.__POSTGRES_CONTAINER__?.stop()
}
