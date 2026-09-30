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

test('pricing widget previews published plans', async ({ page }) => {
  await page.goto('/pricing-widget')

  await expect(page.getByRole('heading', { name: 'Pricing Widget', level: 1 })).toBeVisible()
  await expect(page.locator('[data-testid^="pricing-plan-"]').first()).toBeVisible()
})
