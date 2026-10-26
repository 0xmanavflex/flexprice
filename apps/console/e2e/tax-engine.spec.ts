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

test('turns on Stripe Tax as the tax engine, then resets to Flexprice rates', async ({ page }) => {
  await page.goto('/settings?section=invoicing&tab=tax')
  await expect(
    page.getByText('Flexprice calculates tax from the tax rates set up under Taxes.'),
  ).toBeVisible()

  await page.getByRole('switch', { name: 'Use an external tax engine' }).click()
  // On means an external engine, so Stripe Tax is chosen for you.
  await expect(page.getByRole('combobox', { name: 'Tax engine' })).toContainText('Stripe Tax')
  await expect(
    page.getByText(/Stripe Tax calculates tax on invoices and credit notes/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset to defaults' }).click()
  await expect(page.getByRole('switch', { name: 'Use an external tax engine' })).not.toBeChecked()
  await expect(
    page.getByText('Flexprice calculates tax from the tax rates set up under Taxes.'),
  ).toBeVisible()
})
