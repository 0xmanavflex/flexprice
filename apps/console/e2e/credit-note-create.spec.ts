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

test('creates a draft credit memo, finalizes it, then voids it', async ({ page }) => {
  await page.goto('/credit-memos')
  await page.getByRole('button', { name: 'New credit memo' }).click()
  await expect(page).toHaveURL(/\/credit-memos\/new$/)

  await page.getByRole('combobox', { name: /Invoice/ }).click()
  await page.getByRole('option').first().click()

  const firstLine = page.getByLabel(/^Credit for /).first()
  await expect(firstLine).toBeVisible()
  await page.getByRole('button', { name: 'Create credit memo' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Credit at least one line' }),
  ).toBeVisible()

  await firstLine.fill('10.00')
  await page.getByRole('button', { name: 'Create credit memo' }).click()

  await expect(page).toHaveURL(/\/credit-memos\/cnote_new_/)
  await expect(page.getByText('Draft').first()).toBeVisible()
  const document = page.getByRole('article', { name: 'Credit memo document' })
  await expect(document.getByText('Total credited')).toBeVisible()
  await expect(document.getByRole('table', { name: 'Credited lines' })).toBeVisible()

  await page.getByRole('button', { name: 'Credit memo actions' }).click()
  await page.getByRole('menuitem', { name: 'Finalize' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Finalize' }).click()
  await expect(page.getByText('Finalized').first()).toBeVisible()

  await page.getByRole('button', { name: 'Credit memo actions' }).click()
  await page.getByRole('menuitem', { name: 'Void credit memo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Void credit memo' }).click()
  await expect(page.getByText('Voided').first()).toBeVisible()
})
