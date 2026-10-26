// Detectan cambios de POSICIÓN comparando cajas (boundingBox) entre sí, no píxeles exactos:
// toleran otra fuente u otro tamaño de texto, pero fallan si la grilla o la insignia se mueven.
import type { Locator } from '@playwright/test'
import { expect, test } from '../fixtures'
import { availabilityBadge, openCatalog } from '../support/ui'

async function boxes(locator: Locator) {
  const all = await locator.all()
  return Promise.all(
    all.map(async (item) => {
      const box = await item.boundingBox()
      if (!box) throw new Error('El elemento no es visible')
      return box
    }),
  )
}

const distinctColumns = (list: { x: number }[]) => new Set(list.map((b) => Math.round(b.x))).size

test.describe('escritorio (1280 px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('[UI-CAT-4] las tarjetas forman una grilla de 3 columnas', async ({ page }) => {
    await openCatalog(page)
    const cards = await boxes(page.getByRole('article'))
    expect(cards).toHaveLength(6)
    expect(distinctColumns(cards)).toBe(3)
    // Las tres primeras comparten fila.
    expect(new Set(cards.slice(0, 3).map((b) => Math.round(b.y))).size).toBe(1)
  })

  test('[UI-CAT-4] la insignia queda en la esquina superior derecha de su tarjeta', async ({
    page,
  }) => {
    await openCatalog(page)
    for (const title of ['Cien años de soledad', 'La casa de los espíritus']) {
      const [card] = await boxes(page.getByRole('article', { name: title, exact: true }))
      const [badge] = await boxes(availabilityBadge(page, title))
      const gapRight = card.x + card.width - (badge.x + badge.width)
      const gapTop = badge.y - card.y
      expect(gapRight, `${title}: distancia al borde derecho`).toBeLessThanOrEqual(32)
      expect(gapTop, `${title}: distancia al borde superior`).toBeLessThanOrEqual(32)
      expect(badge.x, `${title}: la insignia está en la mitad derecha`).toBeGreaterThan(
        card.x + card.width / 2,
      )
    }
  })

  test('[UI-CAT-4] el buscador queda sobre la grilla', async ({ page }) => {
    await openCatalog(page)
    const [search] = await boxes(page.getByRole('search', { name: 'Buscar libros' }))
    const [firstCard] = await boxes(page.getByRole('article').first())
    expect(search.y + search.height).toBeLessThanOrEqual(firstCard.y)
  })

  test('[UI-CAT-7] la casilla "Solo disponibles" queda junto al botón "Buscar"', async ({
    page,
  }) => {
    await openCatalog(page)
    const [button] = await boxes(page.getByRole('button', { name: 'Buscar', exact: true }))
    const [checkbox] = await boxes(page.getByRole('checkbox', { name: 'Solo disponibles' }))
    const [firstCard] = await boxes(page.getByRole('article').first())
    const centerY = (box: { y: number; height: number }) => box.y + box.height / 2
    expect(checkbox.x, 'la casilla está a la derecha del botón').toBeGreaterThanOrEqual(
      button.x + button.width,
    )
    expect(checkbox.x - (button.x + button.width), 'distancia al botón').toBeLessThanOrEqual(32)
    expect(Math.abs(centerY(checkbox) - centerY(button)), 'misma fila').toBeLessThanOrEqual(4)
    expect(checkbox.y + checkbox.height).toBeLessThanOrEqual(firstCard.y)
  })
})

test.describe('móvil (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('[UI-CAT-4] las tarjetas forman una sola columna', async ({ page }) => {
    await openCatalog(page)
    const cards = await boxes(page.getByRole('article'))
    expect(distinctColumns(cards)).toBe(1)
    const ys = cards.map((b) => b.y)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })
})
