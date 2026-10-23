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

/**
 * The Events Debugger promises to show what arrived, filterable, and to open
 * one event to its verbatim payload. The filter and the sort are server-side,
 * so the assertions are on what the mock endpoint returned for them.
 */
test.describe('the events debugger', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Events Debugger', searchLabel: 'Search events' })

  test('renders the ingest log, newest first', async ({ page }) => {
    const events = list(page)
    await page.goto('/events')

    // The shell names the page in its breadcrumb; list pages render no h1.
    await expect(page.getByRole('link', { name: 'Events Debugger' })).toBeAttached()
    await expect(events.rows().first()).toBeVisible()
    // The fixtures run 2026-09-01 00:00 upward an hour apart; newest first
    // means the first row is the last of them (60th, index 59 -> 2026-09-03).
    await expect(events.rows().first()).toContainText('Sep 3, 2026')
  })

  test('puts the event-name search in the URL and survives a reload', async ({ page }) => {
    const events = list(page)
    await page.goto('/events')
    await expect(events.rows().first()).toBeVisible()

    await events.search.fill('storage_gb')
    await expect(page).toHaveURL(/[?&]search=storage_gb/)
    await expect(events.rows().first()).toContainText('storage_gb')

    await page.reload()
    await expect(events.search).toHaveValue('storage_gb')
    await expect(events.rows().first()).toContainText('storage_gb')
  })

  test('opens an event to its verbatim properties', async ({ page }) => {
    const events = list(page)
    await page.goto('/events')

    await events.openFirstRow()

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Properties')).toBeVisible()
    await expect(sheet.getByText('"region"')).toBeVisible()
  })
})
