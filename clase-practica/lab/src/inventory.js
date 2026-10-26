export function createInventory(initialStock = {}) {
  const stock = new Map(Object.entries(initialStock))

  return {
    isAvailable(sku, qty) {
      return (stock.get(sku) ?? 0) >= qty
    },
    reserve(sku, qty) {
      stock.set(sku, (stock.get(sku) ?? 0) - qty)
    },
    stockOf(sku) {
      return stock.get(sku) ?? 0
    },
  }
}
