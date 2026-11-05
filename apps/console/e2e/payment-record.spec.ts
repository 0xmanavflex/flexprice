import type { Page } from '@playwright/test'
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

async function recordPayment(page: Page, amount: string) {
  await page.goto('/payments')
  await page.getByRole('button', { name: 'Record payment' }).click()
  await expect(page).toHaveURL(/\/payments\/new$/)
  await page.getByRole('combobox', { name: /Invoice/ }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /Currency/ }).click()
  await page.getByRole('option', { name: 'USD' }).click()
  await page.getByLabel('Amount').fill(amount)
  await page.getByRole('switch', { name: /Process now/ }).click()
  await page.getByRole('button', { name: 'Create payment' }).click()
  await expect(page).toHaveURL(/\/payments\/pay_new_/)
}

test('records a payment, processes a pending one, then no longer offers delete', async ({
  page,
}) => {
  await page.goto('/payments')
  await page.getByRole('button', { name: 'Record payment' }).click()
  await expect(page).toHaveURL(/\/payments\/new$/)

  await page.getByRole('button', { name: 'Create payment' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Choose an invoice' })).toBeVisible()

  await page.getByRole('combobox', { name: /Invoice/ }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /Currency/ }).click()
  await page.getByRole('option', { name: 'USD' }).click()
  await page.getByLabel('Amount').fill('0')
  await page.getByRole('button', { name: 'Create payment' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'above zero' })).toBeVisible()

  await page.getByLabel('Amount').fill('120.50')
  await page.getByRole('switch', { name: /Process now/ }).click()
  await page.getByRole('button', { name: 'Create payment' }).click()

  await expect(page).toHaveURL(/\/payments\/pay_new_/)
  await expect(page.getByText('Initiated').or(page.getByText('Pending')).first()).toBeVisible()

  await page.getByRole('button', { name: 'Payment actions' }).click()
  await page.getByRole('menuitem', { name: 'Process payment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Process payment' }).click()
  await expect(page.getByText('Succeeded').first()).toBeVisible()

  // A succeeded payment moved money: the API only voids or refunds it, so Delete is not offered.
  // With nothing left to process or copy, this offline payment has no actions menu at all.
  await expect(page.getByRole('button', { name: 'Payment actions' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Delete payment' })).toHaveCount(0)
})

test('deletes a payment that was recorded but never processed', async ({ page }) => {
  await recordPayment(page, '12')
  await page.getByRole('button', { name: 'Payment actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete payment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete payment' }).click()
  await expect(page).toHaveURL(/\/payments$/)
})
