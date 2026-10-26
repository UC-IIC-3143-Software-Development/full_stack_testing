import { createApp } from './app.js'
import { createInventory } from './inventory.js'

const app = createApp({
  inventory: createInventory({ 'SKU-1': 10, 'SKU-2': 3 }),
  validTokens: new Set(['demo-token']),
})

app.listen(3000, () => console.log('http://localhost:3000'))
