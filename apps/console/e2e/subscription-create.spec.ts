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

test('creates a contract through the steps and posts it', async ({ page }) => {
  await page.goto('/contracts/new')
  // Customer and plan are one step. The plan half is withheld until there is a
  // customer, so the step opens as one question.
  await expect(page.getByRole('heading', { name: 'Customer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toHaveCount(0)

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
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible()
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

  // No summary rail and no first-invoice estimate: the API has none to give.
  await expect(page.getByRole('complementary', { name: 'Summary' })).toHaveCount(0)
  // Save as draft sits in the header on every step.
  await expect(page.getByRole('button', { name: 'Save as draft' })).toBeVisible()

  const titles: Record<string, string> = {
    phases: 'Charges',
    commitments: 'Contract commitment',
    billing: 'Customer hierarchy',
    review: 'Commitments & benefits',
  }
  for (const step of ['phases', 'commitments', 'billing', 'review']) {
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(new RegExp(`step=${step}`), { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: titles[step], exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0)

  const request = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/v1\/subscriptions$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Create contract' }).click()
  await request

  await expect(page).toHaveURL(/\/contracts$/)
})

test('creates a contract that other customers inherit', async ({ page }) => {
  await page.goto('/contracts/new')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /^Plan/ }).click()
  await page.getByRole('option').first().click()
  const currency = page.getByRole('combobox', { name: /Currency/ })
  if ((await currency.textContent())?.includes('Choose')) {
    await currency.click()
    await page.getByRole('option').first().click()
  }

  for (const step of ['phases', 'commitments', 'billing']) {
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(new RegExp(`step=${step}`), { timeout: 15_000 })
  }

  // V1's term. A customer with a contract of its own cannot inherit, so it is
  // listed but not choosable; pick the first one that can.
  const picker = page.getByRole('combobox', { name: /^Inherited customers/ })
  await expect(picker).toHaveAttribute('placeholder', 'Add customers to inherit…')
  await picker.click()
  await page.locator('[role="option"]:not([aria-disabled="true"])').first().click()
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(1)

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/step=review/, { timeout: 15_000 })

  // The mock echoes the request it was sent, so the response shows what went out.
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && /\/v1\/subscriptions$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: 'Create contract' }).click()
  // The contract's own customer pays for its inheritors, so only they are sent.
  const { inheritance } = (await (await response).json()) as {
    inheritance?: Record<string, unknown>
  }
  expect(inheritance?.['external_customer_ids_to_inherit_subscription']).toHaveLength(1)
  expect(inheritance).not.toHaveProperty('invoicing_customer_external_id')
  await expect(page).toHaveURL(/\/contracts$/)
})
