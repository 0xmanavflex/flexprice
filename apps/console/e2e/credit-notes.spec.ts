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
