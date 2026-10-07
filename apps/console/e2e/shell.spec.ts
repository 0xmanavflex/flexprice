import { expect, test } from '@playwright/test'

import { ShellPage } from './pages/shell'

/** Seed the mock demo session (see catalog.spec.ts) — the guard now requires a
 *  sign-in even under mocks, so the journeys seed rather than click through it. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* private-mode browser */
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
})

/**
 * The surfaces, and moving between them.
 *
 * Every surface renders the MSW fixture corpus rather than live data, so these
 * assert what is already a promise: each one is reachable, each keeps its own
 * URL, and the shell survives the navigation rather than the surface replacing
 * it. What the records are will change when the data layer lands; that the
 * shell holds and the URL addresses the surface will not.
 *
 * The Product Catalogue is the richest built group, so the click-through walks
 * it. Its paths carry no default query, so each surface's URL is bare — a
 * pageSize the grid fits to the window is the one exception, hence the trailing
 * `(\?|$)` rather than an end-anchored path.
 */
const CATALOG = [
  { name: 'Products', path: '/features' },
  { name: 'Plans', path: '/plans' },
  { name: 'Addons', path: '/addons' },
  { name: 'Pricing page', path: '/pricing-widget' },
] as const

function atPath(path: string): RegExp {
  // Matches the surface's path whether or not the grid appended a fitted
  // pageSize; `(\?|$)` stops `/plans` from also matching `/plans/some-id`.
  return new RegExp(`${path.replace(/\//g, '\\/')}(\\?|$)`)
}

test.describe('the shell', () => {
  test('navigates the catalogue and keeps each surface addressable', async ({ page }) => {
    const shell = new ShellPage(page)
    await shell.goto('/')
    await expect(shell.home).toBeVisible()

    // The parent opens the group and lands on its first child; from there each
    // sibling is one click away.
    await shell.go('Product Catalog')

    for (const surface of CATALOG) {
      await shell.go(surface.name)
      await expect(page).toHaveURL(atPath(surface.path))
      // The shell survives rather than the surface replacing it.
      await expect(shell.home).toBeVisible()
    }
  })

  test('opens a surface directly by its URL', async ({ page }) => {
    // The case a click-through cannot catch: when the SPA fallback rewrite is
    // wrong, a deep link renders nothing and only a fresh load reveals it.
    const shell = new ShellPage(page)
    await shell.goto('/coupons')

    await expect(shell.home).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Coupons' })).toBeAttached()
  })

  test('the footer opens Settings, whose rows reach the pages that configure the product', async ({
    page,
  }) => {
    const shell = new ShellPage(page)
    await shell.goto('/')

    await shell.go('Settings')
    await expect(page).toHaveURL(/\/settings\?section=team/)
    await shell.go('Discounts')
    await expect(page).toHaveURL(atPath('/coupons'))
    await shell.go('Invoicing')
    await expect(page).toHaveURL(/\/settings\?section=billing&tab=invoices/)
    await expect(shell.home).toBeVisible()
  })

  test('a Product Catalogue parent routes to its first child rather than a dead end', async ({
    page,
  }) => {
    // A group heading has no page of its own — clicking it must reach the first
    // child, not do nothing. The child is what the person wanted anyway.
    const shell = new ShellPage(page)
    await shell.goto('/')

    await shell.go('Product Catalog')
    await expect(page).toHaveURL(atPath('/features'))
    await expect(shell.home).toBeVisible()
  })
})
