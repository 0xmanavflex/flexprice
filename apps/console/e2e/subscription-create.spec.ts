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

test('creates a contract in two blocks and posts it', async ({ page }) => {
  await page.goto('/subscriptions/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Create contract' })).toBeVisible()

  // The Customer step is gated on a choice.
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/customer/i).first()).toBeVisible()
  await expect(page).not.toHaveURL(/step=plan/)

  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/step=plan/)

  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  // Currency auto-fills when the plan bills in one; otherwise pick one.
  const currency = page.getByRole('combobox', { name: /Currency/ })
  if ((await currency.textContent())?.includes('Choose')) {
    await currency.click()
    await page.getByRole('option').first().click()
  }

  // Block 2 carries the plan, its charges, entitlements and credit grants together.
  await expect(page.getByText('Credit grants')).toBeVisible({ timeout: 15_000 })

  const request = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/v1\/subscriptions$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: /Create subscription/ }).click()
  await request

  await expect(page).toHaveURL(/\/subscriptions$/)
})
