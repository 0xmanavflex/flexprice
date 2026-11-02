import { type BrowserContext } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Self-billing: the account pill, Usage & billing, Upgrade, the page Stripe
 * returns to, and the read-only lock. The mocks pick the account state from
 * `flexprice.mock.selfBilling` (see `src/mocks/selfBillingHandlers.ts`).
 */
async function signIn(context: BrowserContext, account?: string) {
  await context.addInitScript(
    ([session, state]) => {
      try {
        window.localStorage.setItem('flexprice.session', session)
        if (state) window.localStorage.setItem('flexprice.mock.selfBilling', state)
      } catch {
        /* private-mode browser */
      }
    },
    [
      JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
      account ?? '',
    ] as const,
  )
}

test('no pill while self-billing is off', async ({ context, page }) => {
  await signIn(context)
  await page.goto('/')
  await expect(page.getByRole('heading').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Trial ·|Account locked/ })).toHaveCount(0)
  // A deployment that does not bill its workspaces has no Usage & billing row.
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: 'Team' }).first()).toBeVisible()
  await expect(page.getByText('Usage & billing')).toHaveCount(0)
})

test('the trial chip leads the header: trial chip, search, then Create', async ({
  context,
  page,
}) => {
  await signIn(context, 'trial')
  await page.goto('/customers')
  const pill = page.getByRole('button', { name: /Trial · \d+ days left/ })
  const search = page.getByRole('button', { name: 'Search', exact: true })
  const create = page.getByRole('button', { name: 'Create something new' })
  await expect(pill).toBeVisible()
  const [p, s, c] = await Promise.all([
    pill.boundingBox(),
    search.boundingBox(),
    create.boundingBox(),
  ])
  expect(p!.x).toBeLessThan(s!.x)
  expect(s!.x).toBeLessThan(c!.x)
  if (process.env['SHOT']) {
    await page.screenshot({
      path: process.env['SHOT'],
      clip: { x: p!.x - 40, y: 0, width: 760, height: 60 },
    })
  }
})

test('a trial shows its pill on every page, and the card leads to billing and Upgrade', async ({
  context,
  page,
}) => {
  await signIn(context, 'trial')
  await page.goto('/settings')
  const pill = page.getByRole('button', { name: /Trial · \d+ days left/ })
  await expect(pill).toBeVisible()
  await pill.hover()
  const card = page.getByRole('dialog', { name: 'Free trial' })
  await expect(
    card.getByText(/Then \$199\.00 a month \+ 0\.5% of what you bill through Flexprice\./),
  ).toBeVisible()
  await card.getByRole('button', { name: 'View details' }).click()
  await expect(page).toHaveURL(/\/settings\/usage-billing$/)
  await expect(page.getByText('Free trial, then Pay as you go')).toBeVisible()
  await expect(page.getByText('No invoices yet')).toBeVisible()

  await page.getByRole('button', { name: 'Upgrade' }).last().click()
  await expect(page).toHaveURL(/\/settings\/usage-billing\/go-live$/)
  await expect(page.getByText('Upgrade Flexprice')).toBeVisible()
})

test('upgrading goes to checkout and comes back live', async ({ context, page }) => {
  await signIn(context, 'ending')
  await page.goto('/settings/usage-billing/go-live')
  const companyName = page.getByLabel(/^Company name/)
  await expect(companyName).toBeVisible()
  if ((await companyName.inputValue()) === '') {
    await companyName.fill('Acme Inc')
    await page.getByRole('combobox', { name: /^Address/ }).click()
    await page.getByRole('combobox', { name: /^Address/ }).fill('United States')
    await page.getByRole('option', { name: 'United States (US)' }).click()
    await page.getByLabel('Street').fill('548 Market St')
    await page.getByRole('combobox', { name: 'State' }).fill('California')
    await page.getByRole('option', { name: 'California' }).click()
    await page.getByRole('combobox', { name: 'City' }).fill('San Francisco')
    await page.getByRole('option', { name: 'San Francisco', exact: true }).click()
    await page.getByLabel('Postal code').fill('94104')
  }
  const billingEmail = page.getByLabel(/^Billing email/)
  if ((await billingEmail.inputValue()) === '') await billingEmail.fill('billing@acme.io')
  await page.getByRole('button', { name: 'Continue to payment' }).click()

  await expect(page).toHaveURL(/\/billing\/checkout\/success$/)
  await expect(page.getByRole('heading', { name: "You're live" })).toBeVisible()
  await expect(page.getByRole('button', { name: /Open production/ })).toBeVisible()
  // The account refetched: the pill is gone.
  await expect(page.getByRole('button', { name: /Trial ·|Account locked/ })).toHaveCount(0)
})

test('leaving checkout before paying says nothing was charged', async ({ context, page }) => {
  await signIn(context, 'trial')
  await page.goto('/billing/checkout/failure')
  await expect(page.getByRole('heading', { name: 'You left checkout before paying' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to checkout' }).click()
  await expect(page).toHaveURL(/\/settings\/usage-billing\/go-live$/)
})

test('a locked account reads everything and changes nothing', async ({ context, page }) => {
  await signIn(context, 'limit')
  await page.goto('/features')
  await expect(page.getByRole('button', { name: /Account locked/ })).toBeVisible()
  // The list still reads; its create action is locked, and says why.
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  const locked = page.locator('[data-access="denied"]').first()
  await expect(locked).toBeVisible()
  await expect(locked.locator('[data-slot="locked-mark"]')).toHaveCount(1)
  await locked.hover()
  await expect(page.getByText('Your account is locked. Upgrade to make changes.')).toBeVisible()
  await page.keyboard.press('Escape')
  // Row menus: the writes are off and carry a lock.
  await page.getByRole('button', { name: 'Row actions' }).first().click()
  await expect(page.getByRole('menu').locator('[data-slot="locked-mark"]').first()).toBeVisible()
  await page.keyboard.press('Escape')

  // A create page opened directly is paused.
  await page.goto('/features/new')
  await expect(page.getByRole('heading', { name: 'Creating is paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Upgrade' }).last().click()
  await expect(page.getByText('Upgrade to unlock your account')).toBeVisible()

  // Usage & billing stays open, with the red alert.
  await page.goto('/settings/usage-billing')
  await expect(page.getByText('Your account is locked and read-only')).toBeVisible()
  await expect(page.getByText('Event limit reached')).toBeVisible()
})

test('the environment switcher walks the account states on mocks', async ({ context, page }) => {
  await signIn(context)
  await page.goto('/features')
  await expect(page.getByRole('button', { name: /Trial ·|Account locked/ })).toHaveCount(0)

  const pick = async (name: RegExp) => {
    await page.getByRole('button', { name: /^Environment:/ }).click()
    await expect(page.getByText('Mock accounts')).toBeVisible()
    await page.getByRole('menuitem', { name }).click()
  }

  await pick(/^Trial\s*15 days left/)
  await expect(page.getByRole('button', { name: /Trial · \d+ days left/ })).toBeVisible()

  await pick(/Account locked\s*Event limit reached/)
  await expect(page.getByRole('button', { name: /Account locked/ })).toBeVisible()
  await expect(page.locator('[data-access="denied"]').first()).toBeVisible()

  await pick(/^Live\s*Paid/)
  await expect(page.getByRole('button', { name: /Trial ·|Account locked/ })).toHaveCount(0)
})

test('in the trial, creating Production is the upgrade, and paying lands in Production', async ({
  context,
  page,
}) => {
  await signIn(context, 'trial')
  await page.goto('/features')
  const switcher = page.getByRole('button', { name: /^Environment:/ })
  await switcher.click()
  // A trial has no production yet.
  await expect(page.getByRole('menuitem', { name: /^Production$/ })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'New environment' }).click()

  const dialog = page.getByRole('dialog', { name: 'Create environment' })
  await dialog.getByRole('radio', { name: /production/i }).click()
  await expect(dialog.getByText('Production comes with an upgrade')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: /name/i })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Upgrade' }).click()

  await expect(page).toHaveURL(/\/settings\/usage-billing\/go-live$/)
  const companyName = page.getByLabel(/^Company name/)
  if ((await companyName.inputValue()) === '') await companyName.fill('Acme Inc')
  if ((await page.getByLabel('Street').inputValue()) === '') {
    await page.getByRole('combobox', { name: /^Address/ }).click()
    await page.getByRole('combobox', { name: /^Address/ }).fill('United States')
    await page.getByRole('option', { name: 'United States (US)' }).click()
    await page.getByLabel('Street').fill('548 Market St')
    await page.getByRole('combobox', { name: 'State' }).fill('California')
    await page.getByRole('option', { name: 'California' }).click()
    await page.getByRole('combobox', { name: 'City' }).fill('San Francisco')
    await page.getByRole('option', { name: 'San Francisco', exact: true }).click()
    await page.getByLabel('Postal code').fill('94104')
  }
  const billingEmail = page.getByLabel(/^Billing email/)
  if ((await billingEmail.inputValue()) === '') await billingEmail.fill('billing@acme.io')
  await page.getByRole('button', { name: 'Continue to payment' }).click()

  await expect(page.getByRole('heading', { name: "You're live" })).toBeVisible()
  await page.getByRole('button', { name: /Open production/ }).click()
  await expect(
    page.getByRole('button', { name: /^Environment: Production, production/ }),
  ).toBeVisible()
})
