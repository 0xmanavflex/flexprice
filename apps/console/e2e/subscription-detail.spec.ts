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

test('opens a contract from the list and cancels it', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)
  await expect(page.getByRole('button', { name: 'Contract actions' })).toBeVisible()

  await page.getByRole('button', { name: 'Contract actions' }).click()
  await page.getByRole('menuitem', { name: 'Cancel contract' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel contract' }).click()
  await expect(dialog).toBeHidden()
})
