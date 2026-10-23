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

test.describe('workflows', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Workflows', searchLabel: 'Search workflows' })

  test('lists workflow runs with their type, status and duration', async ({ page }) => {
    const runs = list(page)
    await page.goto('/workflows')

    await expect(runs.rows().first()).toBeVisible()
    await expect(runs.rows().first()).toContainText('wf-')
    await expect(runs.rows().first()).toContainText(/Completed|Failed|Running|Timed out|Canceled/)
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
  })

  test('puts the search in the URL and survives a reload', async ({ page }) => {
    const runs = list(page)
    await page.goto('/workflows')
    await expect(runs.rows().first()).toBeVisible()

    await runs.search.fill('wf-0007')
    await expect(page).toHaveURL(/[?&]search=wf-0007/)
    await expect(runs.rows()).toHaveCount(1)

    await page.reload()
    await expect(runs.search).toHaveValue('wf-0007')
    await expect(runs.rows().first()).toContainText('wf-0007')
  })
})
