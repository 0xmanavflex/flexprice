import { expect, test, type BrowserContext } from '@playwright/test'

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
  await expect(card.getByText(/Then \$199 a month \+ 0\.5%\./)).toBeVisible()
  await card.getByRole('button', { name: 'View details' }).click()
  await expect(page).toHaveURL(/\/settings\/usage-billing$/)
  await expect(page.getByText('Free trial, 30 days')).toBeVisible()
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
    await page.getByLabel('City').fill('San Francisco')
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
  await locked.hover()
  await expect(page.getByText('Your account is locked. Upgrade to make changes.')).toBeVisible()

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
