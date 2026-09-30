import { expect, test, type Page } from '@playwright/test'

import { CatalogListPage } from './pages/catalog'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* private-mode browser: the guard falls back to sign-in, tested elsewhere */
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
})

test.describe('exports', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Exports', searchLabel: 'Search exports' })

  test('lists scheduled exports with their bucket and status', async ({ page }) => {
    const exports = list(page)
    await page.goto('/exports')

    await expect(exports.rows().first()).toBeVisible()
    await expect(page.getByText('acme-billing').first()).toBeVisible()
    await expect(exports.rows().first()).toContainText(/Enabled|Disabled/)
  })

  test('puts the search in the URL and survives a reload', async ({ page }) => {
    const exports = list(page)
    await page.goto('/exports')
    await expect(exports.rows().first()).toBeVisible()

    await page.getByLabel('Search exports').fill('warehouse')
    await expect(page).toHaveURL(/search=warehouse/)
    await expect(exports.rows()).toHaveCount(1)

    await page.reload()
    await expect(page.getByLabel('Search exports')).toHaveValue('warehouse')
    await expect(exports.rows()).toHaveCount(1)
  })
})
