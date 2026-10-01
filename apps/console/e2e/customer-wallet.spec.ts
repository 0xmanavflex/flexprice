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

test('creates, tops up and terminates a wallet', async ({ page }) => {
  await page.goto('/customers')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/customers\/[^/?]+/)
  await page.getByRole('tab', { name: 'Wallet' }).click()

  await expect(page.getByText('No wallet yet')).toBeVisible()
  await page.getByRole('button', { name: 'Create wallet' }).click()
  const create = page.getByRole('dialog', { name: 'Create wallet' })
  await create.getByLabel('Conversion rate').fill('0.01')
  await create.getByLabel('Initial credits (optional)').fill('1000')
  await create.getByRole('button', { name: 'Create wallet' }).click()

  await expect(page.getByText('Current balance')).toBeVisible()
  await expect(page.getByText('1,000 credits').first()).toBeVisible()

  await page.getByRole('button', { name: 'Top up wallet' }).click()
  const topUp = page.getByRole('dialog', { name: 'Top up wallet' })
  await topUp.getByRole('button', { name: 'Top up' }).click()
  await expect(topUp.getByRole('alert')).toContainText('positive number of credits')
  await topUp.getByLabel('Credits').fill('250')
  await topUp.getByRole('button', { name: 'Top up' }).click()
  await expect(page.getByText('1,250 credits').first()).toBeVisible()
  await expect(page.getByText('Purchased credits')).toBeVisible()

  await page.getByRole('button', { name: 'Wallet actions' }).click()
  await page.getByRole('menuitem', { name: 'Terminate wallet' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Terminate wallet' }).click()
  await expect(page.getByText('Terminated')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Top up wallet' })).toBeDisabled()
})
