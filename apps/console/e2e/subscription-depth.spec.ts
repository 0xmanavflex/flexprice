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

test('subscription detail shows pricing and entitlements', async ({ page }) => {
  await page.goto('/subscriptions')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/subscriptions\/[^/]+$/)

  await page.getByRole('tab', { name: 'Pricing' }).click()
  await expect(page.getByText('Platform fee')).toBeVisible()
  await expect(page.getByText('API usage')).toBeVisible()
  await expect(page.getByText(/99\.00/)).toBeVisible()

  await page.getByRole('tab', { name: 'Entitlements' }).click()
  await expect(page.getByText('API calls')).toBeVisible()
  await expect(page.getByText('Single sign-on')).toBeVisible()
  await expect(page.getByText('Unlimited')).toBeVisible()
})
