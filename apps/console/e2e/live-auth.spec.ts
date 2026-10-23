import { expect, test } from './fixtures'

import { CatalogListPage } from './pages/catalog'
import { SignInPage } from './pages/auth'
import { ShellPage } from './pages/shell'

/**
 * Signing in against the real Flexprice API. **Opt-in, and skipped by default.**
 *
 * Every other spec here runs against the mocked build, because a suite that
 * gates a merge must not depend on a network, a shared account or someone
 * else's staging data. This one deliberately does depend on all three, so it
 * only runs when asked for — `pnpm --filter console test:e2e` and CI never
 * touch it, and a missing password is a skip, not a failure.
 *
 * What it buys is the one thing mocks cannot answer: that the token this
 * console asks for is a token the backend actually issues, that the
 * `X-Environment-ID` it then puts on every call is one the backend accepts, and
 * that real rows come back. MSW answers every request correctly by
 * construction; it cannot be wrong about the contract, which is exactly why it
 * cannot confirm it either.
 *
 * ## Running it
 *
 * The app has to be pointed at the real API, and the mocked `webServer` in
 * `playwright.config.ts` cannot be — it is started with `VITE_USE_MOCKS=true`.
 * So start a dev server yourself and hand the suite its URL with
 * `E2E_BASE_URL`, which makes Playwright skip its own server entirely:
 *
 * ```sh
 * # terminal 1 — a dev server pointed at the real API
 * VITE_USE_MOCKS=false \
 * VITE_FLEXPRICE_API_URL=https://api.cloud.flexprice.io/v1 \
 *   pnpm --filter console dev
 *
 * # terminal 2 — the live spec, and only it
 * E2E_LIVE=1 \
 * E2E_USER='e2e-account@example.com' \
 * E2E_PASSWORD='…' \
 * E2E_BASE_URL=http://localhost:3000 \
 *   pnpm --filter console test:e2e live-auth
 * ```
 *
 * The password is read from the environment and never written down here. A
 * credential in a committed file is a credential in every clone, every fork and
 * every CI log that echoes its environment — and rotating it then means finding
 * everyone who pulled.
 */

/** The dedicated E2E account. `E2E_EMAIL` is the older name, still read. */
const email = process.env['E2E_USER'] ?? process.env['E2E_EMAIL']
const password = process.env['E2E_PASSWORD']
/**
 * Which environment holds the rows to assert on.
 *
 * Required for the catalogue test, and deliberately not defaulted. Which
 * environment a console opens in is a per-tenant accident — V1 picks
 * `data[0]` and V2 picks the first non-production one, so on a tenant whose
 * environments are all `development` both simply take whichever the API
 * happened to list first. That environment may be empty while a sibling holds
 * every plan, which is exactly what this account looks like today: the default
 * lands on `Tejas` and the data is in `Sandbox`.
 *
 * Defaulting it would bake one tenant's layout into the suite and make a green
 * run mean "someone's first environment happened to have rows". Naming it makes
 * the assertion say what it checked.
 */
const environment = process.env['E2E_ENVIRONMENT']
const live = process.env['E2E_LIVE'] === '1' && !!email && !!password

test.describe('a real session', () => {
  test.skip(
    !live,
    'Live sign-in is opt-in: set E2E_LIVE=1, E2E_USER, E2E_PASSWORD and E2E_BASE_URL (see the note at the top of this file).',
  )

  // A real backend over a real network is slower than a fixture, and the point
  // of the spec is the contract, not the latency.
  test.setTimeout(60_000)

  test('signs in and renders rows the backend actually returned', async ({ page }) => {
    test.skip(
      !environment,
      'Set E2E_ENVIRONMENT to the environment holding the rows to assert on — the default environment is a per-tenant accident.',
    )

    const signIn = new SignInPage(page)
    await signIn.goto()
    await expect(signIn.heading).toBeVisible()

    await signIn.signIn(email as string, password as string)

    // Signing in leaves the sign-in screen. If the credentials were refused,
    // the form is still here with its one sentence — which is the failure worth
    // seeing in the trace, so it is asserted before anything else.
    await expect(signIn.alert).toHaveCount(0)
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 })

    // An environment has to be *chosen* before rows mean anything. The console
    // opens in whichever one the API listed first, which on a tenant with more
    // than one `development` environment is an accident — so the test names the
    // environment it means instead of asserting against a coin flip.
    const shell = new ShellPage(page)
    await expect(shell.environment).not.toContainText('Loading environments', {
      timeout: 30_000,
    })
    await shell.switchEnvironment(environment as string)

    // The catalogue is the proof. Reaching it means the JWT was accepted, an
    // environment was chosen, and `X-Environment-ID` went out with the call —
    // the three things that are only true against a real backend. Every one of
    // them fails as an empty grid, so the grid is what is asserted.
    const plans = new CatalogListPage(page, { heading: 'Plans', searchLabel: 'Search plans' })
    await page.goto('/plans')

    await expect(plans.heading).toBeVisible({ timeout: 30_000 })
    await expect(plans.grid).toBeVisible({ timeout: 30_000 })
    // Not a count and not a named plan: whose account this is will change, and
    // a test that pins the corpus breaks on someone else's Tuesday. That at
    // least one row came back is the contract.
    await expect(plans.rows().first()).toBeVisible({ timeout: 30_000 })
  })

  test('refuses a wrong password without volunteering whether the account exists', async ({
    page,
  }) => {
    const signIn = new SignInPage(page)
    await signIn.goto()
    await expect(signIn.heading).toBeVisible()

    await signIn.signIn(email as string, 'definitely-not-the-password')

    // The live API answers a wrong password 403 `{"message":"Failed to get
    // user"}` and an unknown address 404 `{"message":"User not found with the
    // provided email"}`. Both have to arrive as the same sentence: the
    // difference between them is an account-enumeration oracle, and the raw
    // text is a backend call stack.
    await expect(
      signIn.alert.filter({ hasText: 'That email and password do not match.' }),
    ).toBeVisible({
      timeout: 30_000,
    })
    await expect(signIn.alert).not.toContainText('Failed to get user')
    await expect(signIn.alert).not.toContainText('User not found')
    await expect(page).toHaveURL(/\/sign-in/)
  })
})
