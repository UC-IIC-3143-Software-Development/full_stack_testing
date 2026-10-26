// Ejemplo del libro (cap. 3): return_order_total(item_prices).
// Los precios negativos representan descuentos. El total nunca es negativo
// y se redondea a 2 decimales trabajando en centavos.
export function orderTotal(itemPrices) {
  if (!Array.isArray(itemPrices)) {
    throw new TypeError('itemPrices must be an array')
  }
  let cents = 0
  for (const price of itemPrices) {
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      throw new TypeError(`invalid price: ${price}`)
    }
    cents += Math.round(price * 100)
  }
  return Math.max(cents, 0) / 100
}

// Valida una línea de pedido. Devuelve la lista de errores (vacía si es válida).
export function validateLine(line) {
  const errors = []
  if (typeof line?.sku !== 'string' || line.sku.trim() === '') {
    errors.push('sku is required')
  }
  if (!Number.isInteger(line?.qty) || line.qty < 1) {
    errors.push('qty must be a positive integer')
  }
  if (typeof line?.price !== 'number' || !Number.isFinite(line.price)) {
    errors.push('price must be a number')
  }
  return errors
}
