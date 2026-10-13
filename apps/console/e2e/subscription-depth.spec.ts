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

test('contract detail overview shows the upcoming invoice and entitlements', async ({ page }) => {
  await page.goto('/subscriptions')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/subscriptions\/[^/]+$/)

  await expect(page.getByRole('heading', { name: 'Contract details' })).toBeVisible()

  const invoice = page.locator('section', {
    has: page.getByRole('heading', { name: 'Upcoming invoice' }),
  })
  await expect(invoice.getByText('Platform fee')).toBeVisible()
  await expect(invoice.getByText('API usage')).toBeVisible()
  await expect(invoice.getByText('Amount due')).toBeVisible()
  await expect(invoice.getByText('$275.56')).toBeVisible()
  // The zero line is hidden by default and comes back when the switch is turned off.
  await expect(invoice.getByText('Extra seats')).toHaveCount(0)
  await invoice.getByRole('switch', { name: 'Hide zero charges' }).click()
  await expect(invoice.getByText('Extra seats')).toBeVisible()

  await expect(page.getByText('API calls', { exact: true })).toBeVisible()
  await expect(page.getByText('Single sign-on')).toBeVisible()
  await expect(page.getByText('Unlimited')).toBeVisible()
})

test('contract detail charges tab lists the contract charges', async ({ page }) => {
  await page.goto('/subscriptions')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/subscriptions\/[^/]+$/)

  await page.getByRole('tab', { name: 'Charges' }).click()
  await expect(page.getByText('Platform fee')).toBeVisible()
  await expect(page.getByText('API usage')).toBeVisible()
  await expect(page.getByText(/99\.00/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Manage pricing' })).toBeVisible()
})
