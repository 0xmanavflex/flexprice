import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ShellPage } from './pages/shell'

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

/** Picks a currency in one of the dialog's pickers. */
async function pick(page: Page, label: string, code: string) {
  await page.getByRole('dialog').getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: code, exact: true }).click()
}

// Only values this journey supplies are asserted: the seeded rates and
// customers can change without the feature breaking.
test('adds and edits a global forex rate in Settings › Currency', async ({ page }) => {
  await page.goto('/settings?section=currency&tab=forex')
  // Whatever is seeded, a rate reads "1 XXX = n YYY".
  await expect(page.getByText(/^1 [A-Z]{3} = [\d.]+ [A-Z]{3}$/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Add rate' }).click()
  const dialog = page.getByRole('dialog')
  await pick(page, 'From currency', 'CHF')
  await pick(page, 'To currency', 'JPY')
  await dialog.getByRole('textbox', { name: /^Rate/ }).fill('172')
  await dialog.getByRole('button', { name: 'Add rate' }).click()
  await expect(page.getByText('1 CHF = 172.00 JPY')).toBeVisible()

  // The API allows one global rate per pair, and says so.
  await page.getByRole('button', { name: 'Add rate' }).click()
  await pick(page, 'From currency', 'CHF')
  await pick(page, 'To currency', 'JPY')
  await dialog.getByRole('textbox', { name: /^Rate/ }).fill('173')
  await dialog.getByRole('button', { name: 'Add rate' }).click()
  await expect(dialog.getByRole('alert')).toContainText('already exists')
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Actions for CHF → JPY' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await dialog.getByRole('textbox', { name: /^Rate/ }).fill('171.5')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('1 CHF = 171.50 JPY')).toBeVisible()
})

test("overrides a customer's rate on the Information tab, then deletes it", async ({ page }) => {
  // An override needs the pair's global rate, so the journey adds its own first,
  // then moves within the app so the mock keeps it.
  await page.goto('/settings?section=currency&tab=forex')
  await page.getByRole('button', { name: 'Add rate' }).click()
  const dialog = page.getByRole('dialog')
  await pick(page, 'From currency', 'CHF')
  await pick(page, 'To currency', 'SEK')
  await dialog.getByRole('textbox', { name: /^Rate/ }).fill('12')
  await dialog.getByRole('button', { name: 'Add rate' }).click()
  await expect(page.getByText('1 CHF = 12.00 SEK')).toBeVisible()

  await new ShellPage(page).go('Customers')
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await page.getByRole('tab', { name: 'Information' }).click()

  await page.getByRole('button', { name: 'Add override' }).click()
  await pick(page, 'From currency', 'CHF')
  await pick(page, 'To currency', 'SEK')
  await dialog.getByRole('textbox', { name: /^Rate/ }).fill('11.75')
  await dialog.getByRole('button', { name: 'Add override' }).click()
  const override = page.getByRole('row').filter({ hasText: '1 CHF = 11.75 SEK' })
  await expect(override).toBeVisible()
  await expect(override.getByText('Active')).toBeVisible()

  await override.getByRole('button', { name: 'Actions for CHF → SEK' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await dialog.getByRole('button', { name: 'Delete override' }).click()
  await expect(page.getByText('1 CHF = 11.75 SEK')).toHaveCount(0)
})
