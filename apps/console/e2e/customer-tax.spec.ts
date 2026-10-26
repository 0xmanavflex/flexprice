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

test('attaches a tax rate to a customer, edits it, then removes it', async ({ page }) => {
  await page.goto('/customers')
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await page.getByRole('tab', { name: 'Information' }).click()

  await expect(page.getByText('No tax rates attached')).toBeVisible()
  await page.getByRole('button', { name: 'Add tax rate' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Add tax rate' }).click()
  await expect(dialog.getByRole('alert').filter({ hasText: 'Choose a tax rate' })).toBeVisible()

  await dialog.getByRole('combobox', { name: 'Tax rate' }).click()
  await page.getByRole('option').first().click()
  await dialog.getByLabel('Priority').fill('abc')
  await dialog.getByRole('button', { name: 'Add tax rate' }).click()
  await expect(dialog.getByRole('alert').filter({ hasText: 'whole number' })).toBeVisible()

  await dialog.getByLabel('Priority').fill('10')
  await dialog.getByRole('button', { name: 'Add tax rate' }).click()
  await expect(page.getByRole('cell', { name: '10', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /^Edit [A-Z]+-/ }).click()
  await page.getByRole('dialog').getByLabel('Priority').fill('20')
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('cell', { name: '20', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /^Remove [A-Z]+-/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove tax rate' }).click()
  await expect(page.getByText('No tax rates attached')).toBeVisible()
})
