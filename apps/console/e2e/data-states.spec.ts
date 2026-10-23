import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { CatalogListPage } from './pages/catalog'

declare global {
  interface Window {
    __fail?: { status: number; delayMs: number } | null
  }
}

/**
 * Wraps `fetch` in the page so a test can make the plans search slow or
 * failing on demand. Done in the page rather than with `page.route` because
 * mock mode answers from a service worker, which `page.route` does not see.
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* private-mode browser: the guard falls back to sign-in, tested elsewhere */
      }
      const realFetch = window.fetch.bind(window)
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const fail = window.__fail
        if (fail && /\/plans\/search/.test(url)) {
          if (fail.delayMs) await new Promise((r) => setTimeout(r, fail.delayMs))
          return new Response(JSON.stringify({ error: { message: 'boom' } }), {
            status: fail.status,
            headers: { 'content-type': 'application/json' },
          })
        }
        return realFetch(input, init)
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
})

const plans = (page: Page) =>
  new CatalogListPage(page, { heading: 'Plans', searchLabel: 'Search plans' })

test.describe('data states on the plans list', () => {
  test('a failed load is an error with a working retry, not an empty list', async ({ page }) => {
    await page.addInitScript(() => {
      window.__fail = { status: 403, delayMs: 0 }
    })
    await page.goto('/plans')

    // Forbidden is not retryable, and it must not read as "No plans yet".
    await expect(page.getByText(/no plans yet/i)).toHaveCount(0)
    // The API's own reason is shown in preference to a generic line about
    // roles — `serverReason` in `listFailure.ts`. Here that reason is the
    // injected "boom"; the fallback copy only appears when the server sends
    // none, so asserting on the fallback would test the wrong branch.
    await expect(page.getByText('boom')).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText(/ask an administrator/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /try again/i })).toHaveCount(0)
  })

  test('a server error offers retry and recovers without a reload', async ({ page }) => {
    await page.addInitScript(() => {
      window.__fail = { status: 500, delayMs: 0 }
    })
    await page.goto('/plans')
    const retry = page.getByRole('button', { name: /try again/i })
    await expect(retry).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/no plans yet/i)).toHaveCount(0)

    await page.evaluate(() => {
      window.__fail = null
    })
    await retry.click()
    await expect(plans(page).rows().first()).toBeVisible({ timeout: 45_000 })
  })

  test('a slow response shows a skeleton, never an empty state, and then the rows', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__fail = null
    })
    await page.goto('/plans')
    await expect(plans(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText(/no plans yet/i)).toHaveCount(0)
  })

  test('a search miss says so and offers to clear, without pretending the catalogue is empty', async ({
    page,
  }) => {
    await page.goto('/plans')
    await expect(plans(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await plans(page).search.fill('zzzz-no-such-plan')
    // The grid keeps its header and puts the empty state in its body.
    await expect(page.getByText('No plans match these filters')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/no plans yet/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /clear/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^new plan$/i })).toHaveCount(1)
  })
})
