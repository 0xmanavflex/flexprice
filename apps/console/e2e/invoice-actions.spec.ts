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

test('creates a draft invoice from the form', async ({ page }) => {
  await page.goto('/invoices/new')
  await expect(page.getByRole('heading', { level: 1, name: 'New invoice' })).toBeVisible()

  await page.getByRole('button', { name: 'Create invoice' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a customer' })).toBeVisible()

  await page.getByRole('combobox', { name: /Customer/ }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /Currency/ }).click()
  await page.getByRole('option', { name: 'USD' }).click()
  await page.getByLabel('Line 1 description').fill('Onboarding')
  await page.getByLabel('Line 1 amount').fill('250')
  await page.getByRole('button', { name: 'Add line' }).click()
  await page.getByLabel('Line 2 description').fill('Training')
  await page.getByLabel('Line 2 amount').fill('99.99')
  await expect(page.getByText('349.99 USD')).toBeVisible()
  await page.getByRole('button', { name: 'Create invoice' }).click()

  await expect(page).toHaveURL(/\/invoices\/inv_new_/)
})

test('opens an invoice from the list and shows real lines', async ({ page }) => {
  await page.goto('/invoices')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/invoices\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
  await expect(page.getByText('Orchid Ledger Group')).toHaveCount(0)
})
