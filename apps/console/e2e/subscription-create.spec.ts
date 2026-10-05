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

test('creates a subscription through the steps and posts it', async ({ page }) => {
  await page.goto('/subscriptions/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Create subscription' })).toBeVisible()

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

  for (const step of ['prices', 'entitlements', 'credits', 'review']) {
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(new RegExp(`step=${step}`), { timeout: 15_000 })
  }

  const request = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/v1\/subscriptions$/.test(new URL(r.url()).pathname),
  )
  await page.getByRole('button', { name: /Create subscription/ }).click()
  await request

  await expect(page).toHaveURL(/\/subscriptions$/)
})
