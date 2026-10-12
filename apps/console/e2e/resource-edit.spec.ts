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

test('edits an add-on in place from its detail page', async ({ page }) => {
  await page.goto('/addons')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)

  await page.getByRole('button', { name: 'Add-on actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit add-on details' }).click()

  await page.getByLabel('Name', { exact: true }).fill('Renamed add-on')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Renamed add-on' })).toBeVisible()
})

test('edits a coupon and a cost sheet in place from their detail pages', async ({ page }) => {
  await page.goto('/coupons')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Coupon actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit coupon details' }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()

  await page.goto('/cost-sheets')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Cost sheet actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit cost sheet details' }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
})
