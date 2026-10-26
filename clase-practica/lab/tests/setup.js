import { beforeEach, expect } from 'vitest'

// Baranda: un test sin aserciones falla. (Un agente de IA "pasa" fácilmente
// tests que ejecutan código pero no verifican nada.)
beforeEach(() => {
  expect.hasAssertions()
})
