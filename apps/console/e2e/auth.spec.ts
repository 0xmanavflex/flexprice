import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { CatalogListPage } from './pages/catalog'
import { SignInPage } from './pages/auth'

/**
 * Signing in, against the mocked build.
 *
 * Two promises, and they pull in opposite directions on purpose.
 *
 * The first is that **the mocked app needs no account**. MSW answers every
 * request without a token, and every other spec in this suite, every Storybook
 * story and every `pnpm --filter console dev` depends on the console being
 * usable with nothing signed in. A sign-in wall in front of a fixture corpus
 * protects nothing and breaks everything that is not a human with a password.
 *
 * The second is that **the sign-in screen still has to work**, and it has to be
 * inspectable in the environment developers actually run. A form that is only
 * reachable when pointed at a real backend is a form nobody looks at until it
 * is in front of a user.
 *
 * The rejected-login journey is the one worth having end to end rather than in
 * a story: it crosses the form, the mutation, the error mapping and the
 * recovery behaviour, and a story stubs out at least two of those.
 */

/** What `POST /auth/login` actually answers for a wrong password. */
const REJECTED = JSON.stringify({
  code: 'permission_denied',
  message: 'Failed to get user',
  http_status_code: 401,
})

/**
 * Intercepts login at the context, not the page.
 *
 * MSW covers this build, and it has no handler for `/auth/login`, so its worker
 * relays the request to the network — which means the request leaves from the
 * *service worker*, not from the page. `page.route` does not see those;
 * `context.route` does.
 */
async function rejectLogin(page: Page) {
  const attempts: string[] = []

  await page.context().route('**/auth/login', async (route) => {
    attempts.push(route.request().url())
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: REJECTED,
    })
  })

  return attempts
}

test.describe('the mocked console', () => {
  test('is usable with nobody signed in', async ({ page }) => {
    // The deliberate bypass. If this ever redirects, every other spec in this
    // suite fails too — so it is asserted directly, where the failure names the
    // cause instead of appearing as seven unrelated timeouts.
    const plans = new CatalogListPage(page, { heading: 'Plans', searchLabel: 'Search plans' })
    await page.goto('/plans')

    await expect(page).not.toHaveURL(/\/sign-in/)
    await expect(plans.heading).toBeVisible()
    await expect(plans.rows().first()).toBeVisible()
  })

  test('does not bounce a deep link through a sign-in first', async ({ page }) => {
    // The guard carries the turned-away address in `?redirect=`. Under mocks
    // there is nothing to turn away, so the address resolves as typed.
    await page.goto('/coupons')

    await expect(page).toHaveURL(/\/coupons(\?|$)/)
  })
})

test.describe('the sign-in screen', () => {
  test('renders the form at its own address', async ({ page }) => {
    const signIn = new SignInPage(page)
    await signIn.goto()

    await expect(page).toHaveURL(/\/sign-in/)
    await expect(signIn.heading).toBeVisible()
    await expect(signIn.email).toBeVisible()
    await expect(signIn.password).toBeVisible()
    await expect(signIn.submit).toBeEnabled()
  })

  test('refuses an empty email instead of asking the backend about it', async ({ page }) => {
    const signIn = new SignInPage(page)
    const attempts = await rejectLogin(page)
    await signIn.goto()
    await expect(signIn.heading).toBeVisible()

    await signIn.submit.click()

    // The message names what to do, and it is an alert so it is announced.
    await expect(signIn.alert.filter({ hasText: 'Enter your email' })).toBeVisible()
    await expect(page).toHaveURL(/\/sign-in/)
    // Validation that happens in the browser is the point: an empty form is not
    // a question worth a round trip, or a 4xx in someone's logs.
    expect(attempts).toHaveLength(0)
  })

  test('shows one sentence when the credentials are rejected, and keeps the email', async ({
    page,
  }) => {
    const signIn = new SignInPage(page)
    const attempts = await rejectLogin(page)
    await signIn.goto()
    await expect(signIn.heading).toBeVisible()

    await signIn.signIn('person@example.com', 'wrong-password')

    // Polled, not read once. `signIn()` returns as soon as the click is
    // dispatched, so a bare `expect(attempts)` here races the request it is
    // asking about — it passes or fails on how fast the worker relays the call,
    // which is exactly the kind of green that turns red on a busy machine.
    await expect.poll(() => attempts).toHaveLength(1)

    // Not "Failed to get user", which is the backend's call stack and reads as
    // a system fault — the user retries the same password. And not "User not
    // found", which would turn the form into an account-enumeration oracle.
    await expect(
      signIn.alert.filter({ hasText: 'That email and password do not match.' }),
    ).toBeVisible()
    await expect(signIn.alert).not.toContainText('Failed to get user')

    // Retyping an email you already typed correctly is the small insult that
    // makes a login feel hostile. The password is cleared because it is the
    // field that was wrong, and the cursor is put where the next keystroke
    // belongs.
    await expect(signIn.email).toHaveValue('person@example.com')
    await expect(signIn.password).toHaveValue('')
    await expect(signIn.password).toBeFocused()

    // A rejected sign-in leaves you on the sign-in screen.
    await expect(page).toHaveURL(/\/sign-in/)
  })
})
