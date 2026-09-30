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

test.describe('credit notes', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Credit Notes', searchLabel: 'Search credit notes' })

  test('lists credit notes with their status and invoice', async ({ page }) => {
    const notes = list(page)
    await page.goto('/credit-notes')

    await expect(page.getByRole('link', { name: 'Credit Notes' })).toBeAttached()
    await expect(notes.rows().first()).toBeVisible()
    await expect(notes.rows().first()).toContainText('CN-0001')
    await expect(notes.rows().first()).toContainText('INV-1000')
  })

  test('puts the search in the URL and survives a reload', async ({ page }) => {
    const notes = list(page)
    await page.goto('/credit-notes')
    await expect(notes.rows().first()).toBeVisible()

    await notes.search.fill('globex')
    await expect(page).toHaveURL(/[?&]search=globex/)
    await expect(notes.rows().first()).toContainText('Globex')

    await page.reload()
    await expect(notes.search).toHaveValue('globex')
    await expect(notes.rows().first()).toContainText('Globex')
  })
})
