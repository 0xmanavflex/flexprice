import { expect, test } from './fixtures'

import { CatalogListPage } from './pages/catalog'
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
  { name: 'Features', path: '/features' },
  { name: 'Plans', path: '/plans' },
  { name: 'Add-ons', path: '/addons' },
  { name: 'Pricing widgets', path: '/pricing-widget' },
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
    await shell.go('Product catalog')

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

  test('Settings lists the pages that configure the product, in one flat list', async ({
    page,
  }) => {
    const shell = new ShellPage(page)
    await shell.goto('/')

    await expect(shell.item('Settings')).toHaveCount(0)
    await page.getByRole('button', { name: /^account:/i }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page).toHaveURL(atPath('/settings'))
    const rail = page.getByRole('navigation', { name: 'Settings' })
    await rail.getByRole('button', { name: 'Invoicing' }).click()
    await expect(page).toHaveURL(/\/settings\?section=invoicing/)
    await rail.getByRole('button', { name: 'Coupons' }).click()
    await expect(page).toHaveURL(atPath('/coupons'))
    await expect(shell.home).toBeVisible()
  })

  test('the footer holds Integrations and Documentation, not Settings', async ({ page }) => {
    const shell = new ShellPage(page)
    await shell.goto('/')

    await shell.go('Integrations')
    await expect(page).toHaveURL(atPath('/integrations'))
    // Documentation leaves the console: a link to Flexprice's own docs, new tab.
    const docs = page.getByRole('link', { name: 'Documentation' })
    await expect(docs).toHaveAttribute('href', /^https:\/\/docs\.flexprice\.io\//)
    await expect(docs).toHaveAttribute('target', '_blank')

    // Documentation has one home: the footer, not the account menu as well.
    await page.getByRole('button', { name: /^account:/i }).click()
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Documentation' })).toHaveCount(0)
  })

  test('the Create menu opens the create flows, not the lists', async ({ page }) => {
    const shell = new ShellPage(page)
    await shell.goto('/')

    await page.getByRole('button', { name: 'Create something new' }).click()
    await expect(page.getByRole('menuitem')).toHaveText([
      'New contract',
      'New customer',
      'New invoice',
      'Record a payment',
    ])
    await page.getByRole('menuitem', { name: 'New invoice' }).click()
    await expect(page).toHaveURL(atPath('/invoices/new'))

    await page.getByRole('button', { name: 'Create something new' }).click()
    await page.getByRole('menuitem', { name: 'Record a payment' }).click()
    await expect(page).toHaveURL(atPath('/payments/new'))
  })

  test('renames an environment from the switcher', async ({ page }) => {
    const shell = new ShellPage(page)
    await shell.goto('/customers')
    await expect(shell.environment).not.toContainText('Loading environments')
    const before = await shell.currentEnvironment()

    await shell.environment.click()
    await page.getByRole('menuitem', { name: `Rename ${before}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Rename environment' })
    await dialog.getByRole('textbox', { name: 'Name' }).fill(`${before} renamed`)
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(dialog).toBeHidden()
    await expect(shell.environment).toContainText(`${before} renamed`)
  })

  test('switching environment leaves an id-addressed page for its list', async ({ page }) => {
    const shell = new ShellPage(page)
    await shell.goto('/customers')
    await expect(shell.environment).not.toContainText('Loading environments')
    const current = await shell.currentEnvironment()
    const other = current.includes('Production') ? 'Sandbox' : 'Production'

    const list = new CatalogListPage(page, {
      heading: 'Customers',
      searchLabel: 'Search customers',
    })
    await expect(list.rows().first()).toBeVisible({ timeout: 20_000 })
    // The Email cell is plain text; the External ID cell beside it is a copy button.
    await list.rows().first().getByRole('cell').nth(1).click()
    await expect(page).toHaveURL(/\/customers\/(?!new)[^/]+$/)

    await shell.switchEnvironment(other)
    await expect(page).toHaveURL(atPath('/customers'))

    // A page with no id in its address is valid in every environment and stays.
    await shell.switchEnvironment(current)
    await expect(page).toHaveURL(atPath('/customers'))
  })

  test('a Product Catalogue parent routes to its first child rather than a dead end', async ({
    page,
  }) => {
    // A group heading has no page of its own — clicking it must reach the first
    // child, not do nothing. The child is what the person wanted anyway.
    const shell = new ShellPage(page)
    await shell.goto('/')

    await shell.go('Product catalog')
    await expect(page).toHaveURL(atPath('/plans'))
    await expect(shell.home).toBeVisible()
  })
})
