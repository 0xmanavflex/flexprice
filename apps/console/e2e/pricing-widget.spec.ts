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

test('pricing widget shows the plan catalogue block', async ({ page }) => {
  await page.goto('/pricing-widget')

  await expect(page.getByRole('button', { name: 'Get embed code' })).toBeVisible()
  // The catalogue renders its plan tiles once the plans have loaded; the page-level
  // "Create plan" button is then the only one (the empty state has its own).
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible()
  await expect(page.getByText('No plans to show yet')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create plan' })).toBeVisible()
  await expect(page.getByText('Mara Whitfield')).toHaveCount(0)
})
