import { render, screen } from '@testing-library/react'

test('[UI-CAT-1] muestra el título del libro', () => {
  render(<h2>Rayuela</h2>)
  expect(screen.getByRole('heading').textContent).toBe('Rayuela')
})
