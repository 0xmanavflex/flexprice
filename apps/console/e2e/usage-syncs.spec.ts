import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

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

test.describe('usage syncs', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Usage Syncs', searchLabel: 'Search usage syncs' })

  test('lists usage records with where they were synced', async ({ page }) => {
    const syncs = list(page)
    await page.goto('/usage-syncs')

    await expect(syncs.rows().first()).toBeVisible()
    await expect(syncs.rows().first()).toContainText('customer-01')
    await expect(syncs.rows().first()).toContainText('AWS Marketplace')
  })

  test('opens the sync entries for a record', async ({ page }) => {
    const syncs = list(page)
    await page.goto('/usage-syncs')

    await syncs.rows().first().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText('AWS Marketplace')).toBeVisible()
    await expect(sheet.getByText('Synced', { exact: true })).toBeVisible()
  })

  test('puts the search in the URL and survives a reload', async ({ page }) => {
    const syncs = list(page)
    await page.goto('/usage-syncs')
    await expect(syncs.rows().first()).toBeVisible()

    await syncs.search.fill('customer-05')
    await expect(page).toHaveURL(/[?&]search=customer-05/)
    await expect(syncs.rows()).toHaveCount(1)

    await page.reload()
    await expect(syncs.search).toHaveValue('customer-05')
    await expect(syncs.rows().first()).toContainText('customer-05')
  })
})
