import { expect, test } from './fixtures'

/**
 * A customer's or a contract's open tab is in the URL, so leaving for an
 * invoice and coming back reopens the tab it was left on, not Overview.
 */
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

test("back from an invoice reopens the customer's Invoices tab", async ({ page }) => {
  await page.goto('/customers/cus_synth_0000')
  await page.getByRole('tab', { name: /Invoices/ }).click()
  await expect(page).toHaveURL(/tab=invoices/)
  await page.getByText('NWS-202610-01098').click()
  await expect(page).toHaveURL(/\/invoices\//)
  await page.goBack()
  await expect(page.getByRole('tab', { name: /Invoices/ })).toHaveAttribute('aria-selected', 'true')
})

test('going back to a contract reopens the tab it was left on', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/?]+$/)
  await page.getByRole('tab', { name: /Charges/ }).click()
  await expect(page).toHaveURL(/tab=charges/)
  const contract = page.url()
  // Anywhere else in the console, then back.
  await page.goto('/customers')
  await expect(page).toHaveURL(/\/customers$/)
  await page.goBack()
  await expect(page).toHaveURL(contract)
  await expect(page.getByRole('tab', { name: /Charges/ })).toHaveAttribute('aria-selected', 'true')
})
