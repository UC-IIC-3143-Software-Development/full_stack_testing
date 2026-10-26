// Fixture compartido por los proyectos visual, style, layout y a11y: reloj fijo en cada página.
import { test as base } from '@playwright/test'
import { fixedClockPage } from './support/clock'

export const test = base.extend({ page: fixedClockPage })
export { expect } from '@playwright/test'
