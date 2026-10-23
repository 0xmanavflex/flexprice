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

test.describe('credit memos', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Credit memos', searchLabel: 'Search credit memos' })

  test('lists credit memos with their status and invoice', async ({ page }) => {
    const notes = list(page)
    await page.goto('/credit-memos')

    await expect(page.getByRole('link', { name: 'Credit memos' })).toBeAttached()
    await expect(notes.rows().first()).toBeVisible()
    await expect(notes.rows().first()).toContainText('CN-0001')
    await expect(notes.rows().first()).toContainText('INV-1000')
  })

  test('opens a memo and recovers from a missing Related invoice', async ({ page }) => {
    await page.goto('/credit-memos')
    const row = list(page).rows().first()
    await expect(row).toBeVisible()
    await row.click()
    await expect(page).toHaveURL(/\/credit-memos\/[^/?]+/)
    await page.reload()
    await expect(page.getByRole('article', { name: 'Credit memo document' })).toBeVisible()
    const rail = page.getByRole('complementary', { name: 'Credit memo details' })
    await expect(rail.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible()
    const related = rail.getByRole('region', { name: 'Related', exact: true })
    await related.getByRole('button').first().click()
    await expect(page).toHaveURL(/\/invoices\/[^/?]+/)
    // This fixture's invoice is missing: the link still resolves through the normal detail gate.
    await expect(page.getByRole('alert')).toContainText('Invoice not found')
    await page.getByRole('button', { name: 'Back to invoices' }).click()
    await expect(page).toHaveURL(/\/invoices$/)
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('puts the search in the URL and survives a reload', async ({ page }) => {
    const notes = list(page)
    await page.goto('/credit-memos')
    await expect(notes.rows().first()).toBeVisible()

    await notes.search.fill('lumen')
    await expect(page).toHaveURL(/[?&]search=lumen/)
    await expect(notes.rows().first()).toContainText('Lumen')

    await page.reload()
    await expect(notes.search).toHaveValue('lumen')
    await expect(notes.rows().first()).toContainText('Lumen')
  })
})
