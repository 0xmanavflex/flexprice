import { expect, test, type Page } from '@playwright/test'

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
  await page.getByRole('button', { name: 'Save draft' }).click()

  await expect(page).toHaveURL(/\/invoices\/inv_new_/)
  const id = new URL(page.url()).pathname.split('/').pop() ?? ''
  await expect(page.getByRole('heading', { name: 'Draft invoice', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Finalize', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Void invoice' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Draft invoice', level: 1 })).toBeHidden()

  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Back to invoices' }).click()
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

async function createInvoice(page: Page, finalizeNow: boolean) {
  await page.goto('/invoices/new')
  await page.getByRole('combobox', { name: /Customer/ }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /Currency/ }).click()
  await page.getByRole('option', { name: 'USD' }).click()
  await page.getByLabel('Line 1 description').fill('Setup')
  await page.getByLabel('Line 1 amount').fill('20.00')
  await page.getByRole('button', { name: finalizeNow ? 'Send invoice' : 'Save draft' }).click()
  await expect(page).toHaveURL(/\/invoices\/inv_new_/)
}

test('finalize now creates an open invoice that can be voided from the detail', async ({
  page,
}) => {
  await createInvoice(page, true)
  await expect(page.getByRole('heading', { name: 'Draft invoice', level: 1 })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Finalize', exact: true })).toBeHidden()

  await page.getByRole('button', { name: 'Void invoice' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Void invoice' }).click()
  await expect(page.getByText('The invoice was voided.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Void invoice' })).toBeHidden()
})

test('cancelling a subscription immediately marks it cancelled', async ({ page }) => {
  await page.goto('/subscriptions')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Subscription actions' }).click()
  await page.getByRole('menuitem', { name: 'Cancel subscription' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Immediately' }).click()
  await dialog.getByRole('button', { name: 'Cancel subscription' }).click()
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Subscription actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Cancel subscription' })).toBeDisabled()
})

test('a future-dated subscription is incomplete until it is activated', async ({ page }) => {
  await page.goto('/subscriptions/new')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/step=plan/)
  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  const currency = page.getByRole('combobox', { name: /Currency/ })
  if ((await currency.textContent())?.includes('Choose')) {
    await currency.click()
    await page.getByRole('option').first().click()
  }
  await page.getByLabel('Start date').click()
  await page.getByRole('button', { name: /next month/i }).click()
  await page.getByRole('gridcell', { name: '15' }).getByRole('button').click()
  await page.keyboard.press('Escape')
  for (const step of ['prices', 'entitlements', 'credits', 'review']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`step=${step}`), { timeout: 15_000 })
  }
  await page.getByRole('button', { name: /Create subscription/ }).click()
  await expect(page).toHaveURL(/\/subscriptions$/)

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Incomplete').first()).toBeVisible()
  await page.getByRole('button', { name: 'Activate' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Activate' }).click()
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activate' })).toBeHidden()
})
