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

test('the invoice list opens the invoice creator', async ({ page }) => {
  await page.goto('/invoices')
  await page.getByRole('button', { name: 'New invoice' }).click()

  await expect(page).toHaveURL(/\/invoices\/new$/)
  await expect(page.getByRole('heading', { name: 'Customer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finalize invoice' })).toBeVisible()
})

test('an invoice opens the billing detail block', async ({ page }) => {
  await page.goto('/invoices')
  await page.getByRole('row').nth(1).click()

  await expect(page.getByRole('heading').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Payments' })).toBeVisible()
})
