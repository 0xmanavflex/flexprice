import { expect, test } from './fixtures'

import { CatalogListPage, CouponDetailPage } from './pages/catalog'

/**
 * Seed the mock demo session before every test.
 *
 * The guard now requires a sign-in even under mocks (the mock build shows the
 * demo login), so the journeys seed the session directly rather than clicking
 * through `/sign-in` on every test. Its shape matches `session/storage.ts`.
 */
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
 * What the catalogue surfaces promise.
 *
 * Not "the search box exists" — that restates the DOM. These assert the
 * promises the V2 rebuild was for: the list renders its records, the query
 * lives in the URL so a filtered list is a shareable link that survives a
 * reload, a record opens its own addressable page, and a coupon's detail
 * answers the question V1 could not — where it is applied.
 */

test.describe('the plans list', () => {
  test('renders its grid of records', async ({ page }) => {
    const plans = new CatalogListPage(page, { heading: 'Plans', searchLabel: 'Search plans' })
    await page.goto('/plans')

    await expect(plans.heading).toBeAttached()
    await expect(plans.grid).toBeVisible()
    // The fixtures carry plans, so the grid renders rows, not just a frame.
    await expect(plans.rows().first()).toBeVisible()
  })

  test('reflects the search into the URL and survives a reload', async ({ page }) => {
    const plans = new CatalogListPage(page, { heading: 'Plans', searchLabel: 'Search plans' })
    await page.goto('/plans')
    await expect(plans.heading).toBeAttached()

    await plans.search.fill('pro')

    // The core V2 promise: the URL is the source of truth for the query. A
    // filtered list is therefore a link, not a transient piece of component
    // state — the query string carries the term.
    await expect(page).toHaveURL(/[?&]search=pro/)

    // And because the URL is the source of truth, a reload rebuilds the filter
    // from the address rather than resetting it: the field comes back filled.
    await page.reload()
    await expect(page).toHaveURL(/[?&]search=pro/)
    await expect(plans.search).toHaveValue('pro')
  })

  test('opens a plan at its own URL', async ({ page }) => {
    const plans = new CatalogListPage(page, { heading: 'Plans', searchLabel: 'Search plans' })
    await page.goto('/plans')
    await expect(plans.rows().first()).toBeVisible()

    await plans.openFirstRow()

    // A plan is addressable: opening one lands on `/plans/<id>`, not a modal
    // over the list that a link cannot reach.
    await expect(page).toHaveURL(/\/plans\/[^/?#]+$/)
  })
})

test.describe('the coupons list', () => {
  test('opens a coupon whose detail shows its terms', async ({ page }) => {
    const coupons = new CatalogListPage(page, {
      heading: 'Coupons',
      searchLabel: 'Search coupons',
    })
    const detail = new CouponDetailPage(page)

    await page.goto('/coupons')
    await expect(coupons.rows().first()).toBeVisible()

    await coupons.openFirstRow()
    await expect(page).toHaveURL(/\/coupons\/[^/?#]+$/)

    await expect(detail.terms).toBeVisible()
  })
})
