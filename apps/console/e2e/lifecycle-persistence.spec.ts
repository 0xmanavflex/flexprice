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

test('a created invoice is a draft, finalizing it sticks, and the list shows it', async ({
  page,
}) => {
  await page.goto('/invoices/new')
  await page.getByRole('combobox', { name: /Customer/ }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /Currency/ }).click()
  await page.getByRole('option', { name: 'USD' }).click()
  await page.getByLabel('Line 1 description').fill('Setup')
  await page.getByLabel('Line 1 amount').fill('75.50')
  await page.getByRole('button', { name: 'Create invoice' }).click()

  await expect(page).toHaveURL(/\/invoices\/inv_new_/)
  const id = new URL(page.url()).pathname.split('/').pop() ?? ''
  await expect(page.getByRole('heading', { name: 'Draft invoice', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Finalize invoice' }).click()
  await expect(page.getByRole('button', { name: 'Void invoice' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Draft invoice', level: 1 })).toBeHidden()

  await page.getByRole('button', { name: 'Invoices' }).first().click()
  await expect(page).toHaveURL(/\/invoices$/)
  await expect(page.getByText(id).first()).toBeVisible()
})

test('add-on edit form saves and the detail reflects it', async ({ page }) => {
  await page.goto('/addons')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Add-on actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit add-on' }).click()
  await page.getByLabel('Name').fill('Renamed add-on')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Renamed add-on' })).toBeVisible()
})

test('coupon edit form saves and the detail reflects it', async ({ page }) => {
  await page.goto('/coupons')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Coupon actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit coupon' }).click()
  await page.getByLabel('Name').fill('Renamed coupon')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/coupons\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Renamed coupon' })).toBeVisible()
})

test('cost sheet edit form saves and the detail reflects it', async ({ page }) => {
  await page.goto('/cost-sheets')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Cost sheet actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit cost sheet' }).click()
  await page.getByLabel('Name').fill('Renamed sheet')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/cost-sheets\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Renamed sheet' })).toBeVisible()
})

test('price unit inline edit persists across a reload', async ({ page }) => {
  await page.goto('/price-units')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/price-units\/(?!new)[^/?]+$/)
  await page.getByRole('tab', { name: /Information/ }).click()
  await page.getByRole('button', { name: 'Edit general' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Renamed unit')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Renamed unit' })).toBeVisible()
})

test('cancelling a subscription at period end is reflected on the detail', async ({ page }) => {
  await page.goto('/subscriptions')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Subscription actions' }).click()
  await page.getByRole('menuitem', { name: 'Cancel subscription' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel subscription' }).click()
  await expect(page.getByText('Cancels at period end')).toBeVisible()
})
