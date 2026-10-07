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

// The /integrations route is removed for now; the page code is kept.
test.describe.skip('integrations', () => {
  test('shows the catalogue with connection status', async ({ page }) => {
    await page.goto('/integrations')

    await expect(page.getByRole('heading', { name: 'Available', level: 2 })).toBeVisible()
    await expect(page.getByTestId('integration-stripe')).toContainText('Disconnect')
    await expect(page.getByTestId('integration-razorpay')).toContainText('Not connected')
  })

  test('links a provider to its setup guide', async ({ page }) => {
    await page.goto('/integrations')

    const guide = page.getByRole('link', { name: /Setup guide for Stripe/ })
    await expect(guide).toHaveAttribute('href', 'https://docs.flexprice.io/integrations/stripe/')
    await expect(guide).toHaveAttribute('target', '_blank')
  })
})
