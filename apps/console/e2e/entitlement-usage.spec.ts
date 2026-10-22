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

/*
 * The promise V1 kept and V2 restores: what a customer is entitled to, and how
 * much of it is used, on the contract that grants it and on the customer's
 * overview. Both read `GET /customers/usage`; the contract narrows it to itself.
 */
test('shows entitlement usage on a contract and on its customer’s overview', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)

  const contractEntitlements = page.getByRole('region', { name: 'Entitlements', exact: true })
  await expect(contractEntitlements.getByRole('columnheader', { name: /Usage/ })).toBeVisible({
    timeout: 20_000,
  })
  await expect(contractEntitlements.getByRole('progressbar', { name: /API calls/ })).toBeVisible()
  await expect(contractEntitlements.getByText(/of 250,000 calls/)).toBeVisible()

  // Over to the customer the contract belongs to.
  await page
    .getByRole('region', { name: 'Contract', exact: true })
    .getByRole('button')
    .first()
    .click()
  await expect(page).toHaveURL(/\/customers\/[^/?]+/)

  const customerEntitlements = page.getByRole('region', { name: 'Entitlements', exact: true })
  await expect(customerEntitlements.getByRole('columnheader', { name: /Source/ })).toBeVisible({
    timeout: 20_000,
  })
  await expect(customerEntitlements.getByRole('progressbar', { name: /API calls/ })).toBeVisible()
  // Unlimited is said in words, with no bar to misread.
  await expect(customerEntitlements.getByText('Unlimited').first()).toBeVisible()
})
