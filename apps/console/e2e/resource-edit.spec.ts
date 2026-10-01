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

test('edits an add-on through the full form from its detail page', async ({ page }) => {
  await page.goto('/addons')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)

  await page.getByRole('button', { name: 'Add-on actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit add-on' }).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+\/edit$/)

  await page.getByLabel('Name').fill('Renamed add-on')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)
})

test('opens the coupon and cost sheet edit forms from their detail pages', async ({ page }) => {
  await page.goto('/coupons')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Coupon actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit coupon' }).click()
  await expect(page).toHaveURL(/\/coupons\/[^/]+\/edit$/)
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()

  await page.goto('/cost-sheets')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Cost sheet actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit cost sheet' }).click()
  await expect(page).toHaveURL(/\/cost-sheets\/[^/]+\/edit$/)
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
})
