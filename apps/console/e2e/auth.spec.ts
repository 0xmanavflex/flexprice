import { expect, test } from './fixtures'

import { CatalogListPage } from './pages/catalog'
import { SignInPage } from './pages/auth'

/**
 * Signing in, against the mocked build.
 *
 * The mocked build **does** sign in. That is a deliberate reversal: the guard
 * used to treat `VITE_USE_MOCKS` as a bypass, and the cost was that the sign-in
 * screen — the first thing every user meets — was the one surface nobody ever
 * looked at while developing. So the mock build ships a demo account
 * (`demo@flexprice.io` / `demo1234`, pre-filled with a hint) whose mock
 * `POST /auth/login` mints a token, and the fixtures are served regardless of
 * that token, so any session is all the guard needs.
 *
 * The other specs seed `flexprice.session` directly rather than clicking
 * through the form; this file is the one that drives it for real.
 *
 * The rejected-login journey is the one worth having end to end rather than in
 * a story: it crosses the form, the mutation, the error mapping and the
 * recovery behaviour, and a story stubs out at least two of those.
 *
 * Nothing here intercepts `/auth/login`. The mock handler already answers a
 * wrong password with the live API's own 403 body, so stubbing it would test
 * the stub — and `context.route` could no longer see the call anyway, now that
 * MSW handles it in the worker instead of relaying it to the network.
 */

test.describe('the mocked console', () => {
  test('turns a signed-out visitor away, then lets the demo account through', async ({ page }) => {
    // The whole loop in one test, because the halves are worthless apart: a
    // guard that redirects but never lets anyone back in is indistinguishable
    // from a broken build, and a sign-in that works but guards nothing is not a
    // guard. The turned-away address rides along in `?redirect=` and is where
    // signing in has to land.
    const plans = new CatalogListPage(page, { heading: 'Plans', searchLabel: 'Search plans' })
    await page.goto('/plans')

    await expect(page).toHaveURL(/\/sign-in\?redirect=/)

    const signIn = new SignInPage(page)
    await expect(signIn.heading).toBeVisible()
    // Pre-filled under mocks, so this is a click and not a typing exercise.
    await expect(signIn.email).toHaveValue('demo@flexprice.io')
    await signIn.submit.click()

    await expect(page).toHaveURL(/\/plans(\?|$)/)
    await expect(plans.heading).toBeVisible()
    await expect(plans.rows().first()).toBeVisible()
  })

  test('a shared link opens as itself after signing in, query string and all', async ({ page }) => {
    // A link someone pasted: a record, and a filtered list. Signing in must
    // land on exactly that address, never on home and never without its query.
    const signIn = new SignInPage(page)
    const invoice = '/invoices/inv_01M38PVF0ES6CFXT6JBCE8M2J7'
    await page.goto(invoice)
    await expect(page).toHaveURL(/\/sign-in\?redirect=/)
    await signIn.submit.click()
    await expect(page).toHaveURL(new RegExp(`${invoice}$`))
    await expect(page.getByText('Invoice not found')).toHaveCount(0)

    await page.evaluate(() => localStorage.clear())
    await page.goto('/invoices?status=draft')
    await expect(page).toHaveURL(/\/sign-in\?redirect=/)
    await signIn.submit.click()
    // The list adds its own normalised params; what was shared is still there.
    await expect(page).toHaveURL(/\/invoices\?status=draft(&|$)/)
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
    await signIn.goto()
    await expect(signIn.heading).toBeVisible()

    // Emptied on purpose: the mock build pre-fills the demo account, so a bare
    // submit here would be a valid sign-in rather than the validation this is
    // about.
    await signIn.email.fill('')
    await signIn.password.fill('')
    await signIn.submit.click()

    // The message names what to do, and it is an alert so it is announced.
    await expect(signIn.alert.filter({ hasText: 'Enter your email' })).toBeVisible()
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test('shows one sentence when the credentials are rejected, and keeps the email', async ({
    page,
  }) => {
    const signIn = new SignInPage(page)
    await signIn.goto()
    await expect(signIn.heading).toBeVisible()

    // Anything that is not the demo account: the mock answers it with the live
    // API's own 403 body, so this exercises the real error mapping.
    await signIn.signIn('person@example.com', 'wrong-password')

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
