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

test('adds and edits a global forex rate in Settings › Currency', async ({ page }) => {
  await page.goto('/settings?section=currency&tab=forex')
  await expect(page.getByText('1 USD = 83.25 INR')).toBeVisible()

  // The API allows one global rate per pair, and says so.
  await page.getByRole('button', { name: 'Add rate' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'From currency' }).click()
  await page.getByRole('option', { name: 'USD', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'To currency' }).click()
  await page.getByRole('option', { name: 'INR', exact: true }).click()
  await dialog.getByRole('textbox', { name: /^Rate/ }).fill('84')
  await dialog.getByRole('button', { name: 'Add rate' }).click()
  await expect(dialog.getByRole('alert')).toContainText('already exists')

  await dialog.getByRole('combobox', { name: 'To currency' }).click()
  await page.getByRole('option', { name: 'GBP', exact: true }).click()
  await dialog.getByRole('button', { name: 'Add rate' }).click()
  await expect(page.getByText('1 USD = 84.00 GBP')).toBeVisible()

  await page.getByRole('button', { name: 'Actions for USD → GBP' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: /^Rate/ }).fill('0.79')
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('1 USD = 0.79 GBP')).toBeVisible()
})

test("overrides a customer's rate on the Information tab, then deletes it", async ({ page }) => {
  await page.goto('/customers')
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await page.getByRole('tab', { name: 'Information' }).click()
  await expect(page.getByText('This customer uses the global forex rates.')).toBeVisible()

  await page.getByRole('button', { name: 'Add override' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'From currency' }).click()
  await page.getByRole('option', { name: 'USD', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'To currency' }).click()
  await page.getByRole('option', { name: 'INR', exact: true }).click()
  await dialog.getByRole('textbox', { name: /^Rate/ }).fill('82.5')
  await dialog.getByRole('button', { name: 'Add override' }).click()
  await expect(page.getByText('1 USD = 82.50 INR')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Active' })).toBeVisible()

  await page.getByRole('button', { name: 'Actions for USD → INR' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete override' }).click()
  await expect(page.getByText('This customer uses the global forex rates.')).toBeVisible()
})
