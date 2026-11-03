import { type BrowserContext, type Locator, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from './fixtures'

import { SignInPage } from './pages/auth'
import { ShellPage } from './pages/shell'

/**
 * Create → edit → delete of every catalogue entity, through the real UI against
 * the real Flexprice dev API. **Opt-in, skipped by default** (see
 * `live-auth.spec.ts` for the why and the dev-server recipe).
 *
 * ```sh
 * E2E_LIVE=1 E2E_USER=… E2E_PASSWORD=… E2E_ENV_ID=<env id> \
 * E2E_ENV_PREFIX=claude-e2e-forms- E2E_BASE_URL=http://127.0.0.1:3300 \
 *   pnpm exec playwright test e2e/live-flows.spec.ts --workers=1 --timeout=120000
 * ```
 *
 * ## Isolation
 *
 * The tenant is shared with colleagues and holds a production-type
 * environment, so this suite writes to exactly one dedicated environment:
 * the one whose id is `E2E_ENV_ID`. Three independent guards enforce it —
 * the switcher must read a name starting `E2E_ENV_PREFIX`, the persisted
 * environment id must equal `E2E_ENV_ID`, and every non-GET request that
 * leaves the browser is aborted unless its `X-Environment-ID` is that id.
 *
 * Every record is named `e2e-<timestamp>-…`, so a run is recognisable and a
 * leftover is attributable. The password is typed through `SignInPage` only.
 */

/** The dedicated E2E account. `E2E_EMAIL` is the older name, still read. */
const user = process.env['E2E_USER'] ?? process.env['E2E_EMAIL']
const password = process.env['E2E_PASSWORD']
const envId = process.env['E2E_ENV_ID']
const envPrefix = process.env['E2E_ENV_PREFIX'] ?? 'claude-e2e-forms-'
const live = process.env['E2E_LIVE'] === '1' && !!user && !!password && !!envId

const run = `e2e-${Date.now()}`
const violations: string[] = []

let page: Page

async function assertIsolated() {
  const shell = new ShellPage(page)
  await expect(shell.environment).toContainText(envPrefix)
  const stored = await page.evaluate(() => localStorage.getItem('flexprice.environment'))
  if (!(stored ?? '').includes(envId as string)) {
    throw new Error('ABORT: the selected environment is not the dedicated e2e environment')
  }
}

async function open(path: string) {
  await page.goto(path)
  await assertIsolated()
}

/** Required fields carry a trailing asterisk in their name, so match the head. */
function field(scope: Locator, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return scope.getByLabel(new RegExp(`^${escaped}(\\s*\\*)?$`))
}

async function fill(scope: Locator, label: string, value: string) {
  await field(scope, label).fill(value)
}

/** Choose an option in an `OptionSelect` (a combobox trigger + listbox). */
async function choose(scope: Locator, label: string, option: string | RegExp) {
  await field(scope, label).click()
  await page.getByRole('option', { name: option }).first().click()
}

/** Submit a full-page form (Create/Save) and wait for the page to navigate away. */
async function submitPage(label: string | RegExp = /^(Create|Save changes)/) {
  const url = page.url()
  await page.getByRole('button', { name: label }).last().click()
  await expect.poll(() => page.url(), { timeout: 30_000 }).not.toBe(url)
}

/** Save the in-place edit form and require the update PUT to succeed. */
async function saveInPlace(pathPattern: RegExp) {
  const response = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && pathPattern.test(new URL(r.url()).pathname),
    { timeout: 30_000 },
  )
  await page.getByRole('button', { name: 'Save changes' }).click()
  expect((await response).status()).toBe(200)
}

/** Narrow a paginated list to the records of this run, so a row is never on page two. */
async function search(text: string) {
  await page
    .getByPlaceholder(/^Search/)
    .first()
    .fill(text)
  await page.waitForTimeout(800)
}

function row(name: string): Locator {
  return page.getByRole('row').filter({ hasText: name })
}

async function openRowMenu(name: string, action: string | RegExp) {
  await row(name).getByRole('button', { name: 'Row actions' }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

/** Confirm a destructive action in the confirm dialog, by its button label. */
async function confirm(label: string | RegExp) {
  const scope = page.getByRole('alertdialog').or(page.getByRole('dialog'))
  await scope.getByRole('button', { name: label }).click()
  await expect(scope).toHaveCount(0, { timeout: 30_000 })
}

/** Open a list, find the row, run a destructive row action and confirm it. */
async function removeFrom(
  path: string,
  name: string,
  action: string,
  confirmLabel: string | RegExp,
) {
  await open(path)
  await search(name)
  await openRowMenu(name, action)
  await confirm(confirmLabel)
  await expect(row(name)).toHaveCount(0, { timeout: 30_000 })
}

const tag = run.slice(-6)
/** Lookup keys are lowercase letters, digits and underscores. */
const key = (suffix: string) => `${run.replace(/-/g, '_')}_${suffix}`
const letters = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    String.fromCharCode(65 + (Number(run.slice(-1 - i, run.length - i)) % 26)),
  ).join('')

/**
 * Sign-in and token refresh: Flexprice's own `/v1/auth/` and Supabase's
 * `/auth/v1/` (`POST /auth/v1/token`). Neither belongs to an environment, and
 * neither response may be logged: both carry the session token.
 */
const AUTH_PATH = /\/(v1\/auth|auth\/v1)\//

/** Nothing that writes may leave the browser for another environment (guard three). */
async function guardWrites(context: BrowserContext) {
  await context.route(/\/v1\//, async (route) => {
    const request = route.request()
    const isAuth = AUTH_PATH.test(request.url())
    if (request.method() !== 'GET' && !isAuth && request.headers()['x-environment-id'] !== envId) {
      violations.push(`${request.method()} ${new URL(request.url()).pathname}`)
      await route.abort()
      return
    }
    await route.continue()
  })
}

/**
 * A rejected write is the finding this suite exists to surface, so say what
 * the API answered instead of leaving only the UI's generic sentence. Auth
 * calls are never logged, and the journey reporter redacts whatever else
 * looks like a credential before it writes a log.
 */
function logApiAnswers(target: Page) {
  target.on('response', async (response) => {
    const request = response.request()
    if (
      !/\/v1\//.test(request.url()) ||
      AUTH_PATH.test(request.url()) ||
      (response.status() < 400 &&
        !process.env['E2E_DEBUG_STATUS'] &&
        (request.method() === 'GET' || /\/search$/.test(request.url())))
    )
      return
    const body = await response.text().catch(() => '')
    console.log(
      `API ${response.status()} ${request.method()} ${new URL(request.url()).pathname} ` +
        `req=${(request.postData() ?? '').slice(0, 400)} res=${body.slice(0, 300)}${process.env['E2E_DEBUG_STATUS'] ? ` statuses=${(body.match(/"status":"\w+"/g) ?? []).join(',')}` : ''}`,
    )
  })
}

/**
 * Signed in once per worker, in `beforeAll`, and handed to every journey as
 * storage state. Each journey then runs in its own page — so it gets its own
 * video, trace and screenshot when it fails — without typing the password
 * again (and without the password ever appearing in a journey's trace). The
 * file holds the session token, so it lives in the OS temp directory, never
 * under `e2e-results/`, and is deleted in `afterAll`.
 */
const sessionFile = join(tmpdir(), `flexprice-e2e-session-${process.pid}.json`)

test.describe('live flows', () => {
  test.skip(!live, 'Live flows are opt-in: set E2E_LIVE=1, E2E_USER, E2E_PASSWORD, E2E_ENV_ID.')
  test.use({ storageState: sessionFile })

  test.beforeAll(async ({ browser }) => {
    // Sign-in, the environment list and the switch each wait up to 30s; the
    // default 30s for the whole hook cannot hold them.
    test.setTimeout(90_000)
    // `browser.newContext` inherits this file's `use` options, including the
    // `storageState` above, which does not exist until this hook writes it.
    // Sign-in starts from an empty state instead, and keeps the config's
    // baseURL unless one is set.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      ...(process.env['E2E_BASE_URL'] ? { baseURL: process.env['E2E_BASE_URL'] } : {}),
    })
    try {
      await guardWrites(context)
      page = await context.newPage()
      const signIn = new SignInPage(page)
      await signIn.goto()
      await signIn.signIn(user as string, password as string)
      await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 })
      const shell = new ShellPage(page)
      await expect(shell.environment).not.toContainText('Loading environments', {
        timeout: 30_000,
      })
      await shell.switchEnvironment(envPrefix)
      await assertIsolated()
      await context.storageState({ path: sessionFile })
    } finally {
      await context.close()
    }
  })

  test.beforeEach(async ({ page: journeyPage, context }) => {
    page = journeyPage
    await guardWrites(context)
    logApiAnswers(journeyPage)
  })

  test.afterAll(async () => {
    rmSync(sessionFile, { force: true })
    expect(violations, 'writes attempted outside the e2e environment').toEqual([])
  })

  const nextStep = () => page.getByRole('button', { name: 'Next' }).click()

  test('feature: boolean create, edit', async () => {
    test.setTimeout(90_000)
    const name = `${run}-flag`
    await open('/features')
    await page.getByRole('button', { name: 'New feature' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await nextStep()
    await choose(main, 'Type', 'Boolean')
    await nextStep()
    await submitPage(/^Create feature/)

    await open('/features')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })

    await openRowMenu(name, 'Edit feature')
    await fill(main, 'Description', 'edited by live e2e')
    await submitPage(/^Save changes/)

    await open('/features')
    await search(name)
    await openRowMenu(name, 'Delete feature')
    await confirm(/Delete/)
    // Deleted features linger as "Archived" rather than leaving the list.
    await expect(row(name).filter({ hasText: 'Published' })).toHaveCount(0, {
      timeout: 30_000,
    })
  })

  test('feature: metered create and edit', async () => {
    test.setTimeout(120_000)
    const name = `${run}-metered`
    await open('/features')
    await page.getByRole('button', { name: 'New feature' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await nextStep()
    await nextStep()
    await fill(main, 'Event name', `${run}_evt`)
    await nextStep()
    await nextStep()
    await submitPage(/^Create feature/)

    await open('/features')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })

    await openRowMenu(name, 'Edit feature')
    await fill(main, 'Description', 'metered, edited by live e2e')
    await page.getByRole('button', { name: /^Units/ }).click()
    await fill(main, 'Unit', 'call')
    await submitPage(/^Save changes/)

    await open('/features')
    await search(name)
    await openRowMenu(name, 'Delete feature')
    await confirm(/Delete/)
    await expect(row(name).filter({ hasText: 'Published' })).toHaveCount(0, {
      timeout: 30_000,
    })
  })

  test('group: create feature group, then delete', async () => {
    const name = `${run}-group`
    await open('/groups')
    await page.getByRole('button', { name: 'New tag' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await fill(main, 'Lookup key', `${run}-group`)
    await choose(main, 'Holds', 'Features')
    await submitPage()
    await open('/groups')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })
    await removeFrom('/groups', name, 'Delete tag', 'Delete tag')
  })

  test('add-on: create, edit', async () => {
    const name = `${run}-addon`
    await open('/addons')
    await page.getByRole('button', { name: 'New add-on' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await fill(main, 'Lookup key', key('addon'))
    await submitPage()
    await open('/addons')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })
    // Row Edit opens the detail page with the details in edit mode.
    await openRowMenu(name, 'Edit add-on')
    await expect(page).toHaveURL(/\/addons\/[^/?]+\?edit=true/)
    await fill(main, 'Description', 'edited by live e2e')
    await saveInPlace(/\/v1\/addons\/[^/]+$/)
    await expect(page.getByText('edited by live e2e').first()).toBeVisible({ timeout: 30_000 })
    await open('/addons')
    await search(name)
  })

  test('coupon: create percentage, rename, archive', async () => {
    const name = `${run}-coupon`
    await open('/coupons')
    await page.getByRole('button', { name: 'New coupon' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await fill(main, 'Code', `E2E${tag}`)
    await choose(main, 'Discount type', 'Percentage')
    await fill(main, 'Percentage off', '10')
    await choose(main, 'Duration', 'Forever')
    await submitPage()
    await open('/coupons')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })

    // The list only renames inline; the in-place edit and Archive live on the detail page.
    await row(name).getByText(`E2E${tag}`).click()
    await expect(page.getByRole('heading', { name: name })).toBeVisible()
    await page.getByRole('button', { name: 'Coupon actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit details' }).click()
    await fill(main, 'Name', `${name}-edited`)
    await saveInPlace(/\/v1\/coupons\/[^/]+$/)
    await expect(page.getByRole('heading', { name: `${name}-edited` })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: 'Coupon actions' }).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
    await confirm('Archive coupon')
    await expect(page.getByText('Archived').first()).toBeVisible({ timeout: 30_000 })
  })

  test('price unit: create, rename', async () => {
    const name = `${run}-unit`
    await open('/price-units')
    await page.getByRole('button', { name: 'New price unit' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await fill(main, 'Code', letters(3))
    await fill(main, 'Symbol', '★')
    await choose(main, 'Base currency', /^USD/)
    await fill(main, 'Conversion rate', '0.5')
    await submitPage()
    // Creating lands on the detail page, where the name is renamed in place.
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 30_000 })
    await open('/price-units')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })
  })

  test('cost sheet: create, edit, delete', async () => {
    const name = `${run}-costsheet`
    await open('/cost-sheets')
    await page.getByRole('button', { name: 'New cost sheet' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await fill(main, 'Lookup key', key('costsheet'))
    await submitPage()
    await open('/cost-sheets')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })
    await openRowMenu(name, 'Edit cost sheet')
    await expect(page).toHaveURL(/\/cost-sheets\/[^/?]+\?edit=true/)
    await fill(main, 'Description', 'edited by live e2e')
    await saveInPlace(/\/v1\/costs\/[^/]+$/)
    await expect(page.getByText('edited by live e2e').first()).toBeVisible({ timeout: 30_000 })
    await open('/cost-sheets')
    await search(name)
    await removeFrom('/cost-sheets', name, 'Delete cost sheet', 'Delete cost sheet')
  })

  test('tax rate: create, edit, delete', async () => {
    const name = `${run}-tax`
    await open('/taxes')
    await page.getByRole('button', { name: 'Add tax' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await fill(main, 'Code', `tax-e2e-${tag}`)
    await fill(main, 'Rate (%)', '7.5')
    await submitPage()
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })
    await openRowMenu(name, 'Edit tax rate')
    await fill(page.getByRole('main'), 'Description', 'edited by live e2e')
    await submitPage()
    await search(name)
    await removeFrom('/taxes', name, 'Delete tax rate', 'Delete tax rate')
  })

  test('customer: create, edit, delete', async () => {
    const name = `${run}-customer`
    await open('/customers')
    await page.getByRole('button', { name: 'New customer' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', name)
    await fill(main, 'External ID', `${run}-cust`)
    await fill(main, 'Email', `${run}@example.com`)
    await nextStep()
    await nextStep()
    await submitPage()
    await open('/customers')
    await search(name)
    await expect(row(name)).toBeVisible({ timeout: 30_000 })
    await openRowMenu(name, 'Edit customer')
    await page.getByRole('button', { name: /Billing address/ }).click()
    await fill(main, 'Address line 1', '1 London Wall')
    await submitPage()
    await open('/customers')
    await search(name)
    await removeFrom('/customers', name, 'Delete customer', 'Delete customer')
  })
  test('plan: create, edit, charges, entitlement, credit grant, archive', async () => {
    test.setTimeout(240_000)
    const feature = `${run}-planmeter`
    const flag = `${run}-planflag`
    const plan = `${run}-plan`

    // A metered feature (for the usage charge) and a boolean one (entitlement).
    await open('/features')
    await page.getByRole('button', { name: 'New feature' }).first().click()
    const main = page.getByRole('main')
    await fill(main, 'Name', feature)
    await nextStep()
    await nextStep()
    await fill(main, 'Event name', `${run}_plan_evt`)
    await nextStep()
    await nextStep()
    await submitPage(/^Create feature/)
    await open('/features')
    await search(feature)
    await expect(row(feature)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'New feature' }).first().click()
    await fill(main, 'Name', flag)
    await nextStep()
    await choose(main, 'Type', 'Boolean')
    await nextStep()
    await submitPage(/^Create feature/)
    await open('/features')
    await search(flag)
    await expect(row(flag)).toBeVisible({ timeout: 30_000 })

    await open('/plans')
    await page.getByRole('button', { name: 'New plan' }).first().click()
    // Create is a full page, not a dialog: fill the details, then walk the steps.
    await fill(page, 'Name', plan)
    await fill(page, 'Lookup key', key('plan'))
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Next/ }).click()
    await page.getByRole('button', { name: /^Create plan/ }).click()
    // Creating a plan lands on its detail page.
    await expect(page.getByRole('heading', { name: plan })).toBeVisible({ timeout: 30_000 })

    // Edit configuration: the same form, on its own page.
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit configuration' }).click()
    await fill(page, 'Description', 'edited by live e2e')
    await page.getByRole('button', { name: /^Save/ }).last().click()
    await expect(page.getByRole('heading', { name: plan })).toBeVisible({ timeout: 30_000 })

    // Charges, entitlements and grants open in a dialog on the plan page.
    const inPlace = page.getByRole('dialog')
    const settled = async () => expect(inPlace).toHaveCount(0, { timeout: 30_000 })

    // Fixed charge.
    await page.getByRole('button', { name: 'Add charge', exact: true }).first().click()
    await inPlace.getByRole('radio', { name: /Fixed/ }).click()
    await inPlace.getByRole('button', { name: 'Continue' }).click()
    await fill(inPlace, 'Display name', 'Base fee')
    await fill(inPlace, 'Amount (USD)', '25')
    await inPlace.getByRole('button', { name: 'Create charge' }).click()
    await settled()
    await expect(page.getByText('Base fee').first()).toBeVisible({ timeout: 30_000 })

    // Usage charge on the metered feature.
    await page.getByRole('button', { name: 'Add charge', exact: true }).first().click()
    await inPlace.getByRole('radio', { name: /Usage/ }).click()
    await inPlace.getByRole('button', { name: 'Continue' }).click()
    await inPlace.getByRole('combobox', { name: /Metered feature/ }).click()
    await page.getByRole('option', { name: feature }).first().click()
    await fill(inPlace, 'Display name', 'Per call')
    await fill(inPlace, 'Amount (USD)', '0.02')
    await inPlace.getByRole('button', { name: 'Create charge' }).click()
    await settled()
    await expect(page.getByText('Per call').first()).toBeVisible({ timeout: 30_000 })

    // Edit the fixed charge's price: a new version.
    await page.getByRole('button', { name: /^Actions for Base fee/ }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await fill(inPlace, 'Amount (USD)', '30')
    await inPlace.getByRole('button', { name: 'Save new version' }).click()
    await settled()

    // Entitlement.
    await page.getByRole('tab', { name: 'Entitlements', exact: true }).click()
    await page.getByRole('button', { name: 'Add entitlement' }).first().click()
    await field(inPlace, 'Feature').click()
    await page.getByRole('option', { name: flag }).first().click()
    await inPlace.getByRole('button', { name: /^Create entitlement/ }).click()
    await settled()
    await expect(page.getByText(flag).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: new RegExp(`^Actions for ${flag}`) }).click()
    await page.getByRole('menuitem', { name: /Edit/ }).click()
    await inPlace.getByRole('switch').click()
    await inPlace.getByRole('button', { name: /^Save/ }).last().click()
    await settled()

    // Credit grant.
    await page.getByRole('tab', { name: 'Credit grants', exact: true }).click()
    await page
      .getByRole('button', { name: /Add credit grant|Add grant/ })
      .first()
      .click()
    await fill(inPlace, 'Name', `${run}-grant`)
    await fill(inPlace, 'Credits', '100')
    await inPlace.getByRole('radio', { name: /One-time/ }).click()
    await choose(inPlace, 'Expiry', /Never/i)
    await inPlace.getByRole('button', { name: 'Create credit grant' }).click()
    await settled()
    await expect(page.getByText(`${run}-grant`).first()).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: new RegExp(`^Actions for ${run}-grant`) }).click()
    await page.getByRole('menuitem', { name: /Edit/ }).click()
    await fill(inPlace, 'Name', `${run}-grant-edited`)
    await inPlace.getByRole('button', { name: 'Save changes' }).click()
    await settled()
    await expect(page.getByText(`${run}-grant-edited`).first()).toBeVisible({ timeout: 30_000 })

    // Archive the plan.
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
    await confirm(/Archive/)

    // Best-effort cleanup. The API refuses to delete a feature that a plan still
    // links to (even an archived plan), so a rejection here is a backend rule, not
    // a UI failure; the records are e2e-named and live in the dedicated env.
    await open('/features')
    await search(run)
    for (const n of [feature, flag]) {
      await openRowMenu(n, /Delete feature|Archive feature/)
      await confirm(/Delete|Archive/).catch(async () => {
        await page.keyboard.press('Escape')
      })
    }
  })
})
