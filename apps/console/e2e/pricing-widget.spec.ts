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

test('pricing widget shows the published plans for a billing period and currency', async ({
  page,
}) => {
  await page.goto('/pricing-widget')

  await expect(page.getByRole('heading', { name: 'Pricing widget', level: 1 })).toBeVisible()
  // As V1: a billing period and a currency, no embed code and no banner.
  await expect(page.getByRole('combobox', { name: 'Billing period' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Currency' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get embed code' })).toHaveCount(0)
  await expect(page.getByText(/published plans? (is|are) shown/)).toHaveCount(0)
  // The mock catalogue prices plans, so cards render, each opening its plan.
  const viewPlan = page.getByRole('button', { name: 'View plan' }).first()
  await expect(viewPlan).toBeVisible()
  await viewPlan.click()
  await expect(page).toHaveURL(/\/plans\/[^/]+$/)
})
