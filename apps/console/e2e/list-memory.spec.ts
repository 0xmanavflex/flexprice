import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

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
 * A list's filters survive a trip to a detail page and back.
 *
 * `listMemory.test.ts` covers the rules; this covers the wiring, which is the
 * part that can be right in isolation and wrong in the router. Each test drives
 * the real search box and the real breadcrumb.
 */
const search = (page: Page) => page.getByRole('textbox', { name: 'Search features' })

async function filterFeatures(page: Page, term: string) {
  await page.goto('/features')
  await expect(page.getByRole('table')).toBeVisible({ timeout: 45_000 })
  await search(page).fill(term)
  // The router serialises the query object, so the long spelling is what
  // lands in the URL; the parser reads both (see `featureSearch.ts`).
  await expect(page).toHaveURL(new RegExp(`[?&]search=${term}`))
}

test('a filtered list comes back filtered', async ({ page }) => {
  await filterFeatures(page, 'api')

  // Into a feature and back out through the breadcrumb — an in-app navigation,
  // which is the one that used to drop the filter.
  await page.getByRole('table').getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/features\/feat_/)
  await page
    .getByRole('navigation', { name: /breadcrumb/i })
    .getByRole('button', { name: 'Features', exact: true })
    .click()

  await expect(page).toHaveURL(/[?&]search=api/)
  await expect(search(page)).toHaveValue('api')
})

test('clearing the filter is remembered too', async ({ page }) => {
  await filterFeatures(page, 'api')
  await search(page).fill('')
  await expect(page).toHaveURL(/\/features$/)

  /*
   * Wait for the clear to be *written*, not just shown.
   *
   * The URL goes bare on the keystroke; the memory is written by an effect
   * on the render after it. `page.goto` is a full load that tears the app
   * down, so navigating on the URL alone raced the write — the store still
   * held "api", and coming back restored it. It failed only under CI's
   * parallel load, which is exactly the kind of race a URL assertion hides.
   */
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('fp.listMemory.v1') ?? ''))
    .not.toContain('"search":"api"')

  await page.goto('/customers')
  await expect(page.getByRole('table')).toBeVisible({ timeout: 45_000 })
  await page.goto('/features')

  // The cleared state is what was last seen, so nothing is put back.
  await expect(page).toHaveURL(/\/features$/)
  await expect(search(page)).toHaveValue('')
})

test('a link that names a filter wins over the remembered one', async ({ page }) => {
  await filterFeatures(page, 'api')

  // Arriving with an explicit query is someone asking for that query — a
  // shared link must not quietly become the recipient's saved view.
  await page.goto('/features?q=token')
  await expect(search(page)).toHaveValue('token')
  await expect(page).toHaveURL(/[?&]q=token/)
  await expect(page).not.toHaveURL(/api/)
})
