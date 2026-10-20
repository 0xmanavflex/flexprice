import { expect, test } from '@playwright/test'

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

test('creates a contract through the steps and posts it', async ({ page }) => {
  await page.goto('/contracts/new')
  // Customer and plan are one step. The plan half is withheld until there is a
  // customer, so the step opens as one question.
  await expect(page.getByRole('heading', { name: 'Customer' })).toBeVisible()
  await expect(page.getByText('Plan and billing')).toHaveCount(0)

  // The toolbar carries Next (no Cancel, no Previous on the first step, no bottom bar).
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Previous' })).toHaveCount(0)

  // The step is gated on the customer: Next does not advance without one.
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/customer/i).first()).toBeVisible()
  await expect(page).not.toHaveURL(/step=phases/)

  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()

  // Choosing the customer reveals the plan, in the same step.
  await expect(page.getByText('Plan and billing')).toBeVisible()
  await page.getByRole('combobox', { name: /^Plan/ }).click()
  await page.getByRole('option').first().click()
  // Choosing a plan clears any "Choose a plan" prompt.
  await expect(page.getByText('Choose a plan')).toHaveCount(0)
  // Currency auto-fills when the plan bills in one; otherwise pick one.
  const currency = page.getByRole('combobox', { name: /Currency/ })
  if ((await currency.textContent())?.includes('Choose')) {
    await currency.click()
    await page.getByRole('option').first().click()
  }

  // The rail sums up the choices and the first invoice beside every step but the review.
  const summary = page.getByRole('complementary', { name: 'Summary' })
  await expect(summary).toBeVisible()
  await expect(page.getByRole('region', { name: 'First invoice' })).toBeVisible()

  const titles: Record<string, string> = {
    phases: 'Contract timeline',
    commitments: 'Contract commitment',
    billing: 'Who pays',
    review: 'Add-ons & benefits',
  }
  for (const step of ['phases', 'commitments', 'billing', 'review']) {
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(new RegExp(`step=${step}`), { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: titles[step] })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0)
  await expect(summary).toHaveCount(0)

  const request = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/v1\/subscriptions$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Create contract' }).click()
  await request

  await expect(page).toHaveURL(/\/contracts$/)
})
