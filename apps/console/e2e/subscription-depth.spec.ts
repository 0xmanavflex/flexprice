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

test('contract detail overview shows the upcoming invoice and entitlements', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)

  // The contract's own facts are on the Information tab; the Overview leads
  // with what the contract is doing.
  await expect(page.getByRole('heading', { name: 'Contract', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Information' }).click()
  await expect(page.getByRole('heading', { name: 'Contract', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Billing & collection' })).toBeVisible()
  await page.getByRole('tab', { name: 'Overview' }).click()

  const invoice = page.locator('section', {
    has: page.getByRole('heading', { name: 'Upcoming invoice' }),
  })
  await expect(invoice.getByText('Platform fee')).toBeVisible()
  await expect(invoice.getByText('API usage')).toBeVisible()
  await expect(invoice.getByText('Amount due')).toBeVisible()
  await expect(invoice.getByText('$275.56')).toBeVisible()
  // Zero-amount lines never reach the preview, and there is no switch to bring them back.
  await expect(invoice.getByText('Extra seats')).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'Hide zero charges' })).toHaveCount(0)

  // Scoped to the table's cells: each usage meter also names its feature, for
  // screen readers, so a page-wide text match finds the name twice.
  const entitlements = page.getByRole('region', { name: 'Entitlements', exact: true })
  await expect(entitlements.getByRole('cell', { name: 'API calls', exact: true })).toBeVisible()
  await expect(entitlements.getByRole('cell', { name: 'Single sign-on' })).toBeVisible()
  await expect(entitlements.getByRole('cell', { name: 'Unlimited' })).toBeVisible()
})

test('contract detail charges tab lists the contract charges', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)

  await page.getByRole('tab', { name: 'Charges' }).click()
  await expect(page.getByText('Platform fee')).toBeVisible()
  await expect(page.getByText('API usage')).toBeVisible()
  await expect(page.getByText(/99\.00/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add charge' })).toBeVisible()
})

test('contract detail overview keeps every add section and adds a coupon', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)

  for (const name of ['Entitlements', 'Credit grants', 'Add-ons', 'Coupons', 'Taxes']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  for (const name of [
    'Add entitlement',
    'Add credit grant',
    'Add add-on',
    'Add coupon',
    'Add tax',
  ]) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }

  await page.getByRole('button', { name: 'Add coupon' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: /Coupon/ }).click()
  await page.getByRole('option').first().click()
  await dialog.getByRole('button', { name: 'Add coupon' }).click()
  await expect(dialog).toHaveCount(0)
})

test('adds a one-time credit grant to a contract, with the start date the API requires', async ({
  page,
}) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)

  await page.getByRole('button', { name: 'Add credit grant' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /^Name/ }).fill('Goodwill credits')
  await dialog.getByRole('textbox', { name: /^Credits/ }).fill('500')
  // The mock refuses a contract grant without start_date, as the API does, so
  // the dialog closing is the proof the date was sent.
  await dialog.getByRole('button', { name: 'Add credit grant' }).click()
  await expect(dialog.getByText(/start date/i)).toHaveCount(0)
  await expect(dialog).toHaveCount(0)
})

test('a changed contract price stays as an inactive version, not gone', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)
  await page.getByRole('tab', { name: 'Charges' }).click()

  await page.getByRole('button', { name: 'Actions for API usage' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog')
  const amount = dialog.getByLabel(/^Amount/).first()
  await amount.fill('0.003')
  await dialog.getByRole('button', { name: 'Save charge' }).click()
  await expect(dialog).toBeHidden()

  // One row for the charge, now at its new price, flagged as having history.
  const rows = page.getByRole('row').filter({ hasText: 'API usage' })
  await expect(rows).toHaveCount(1)
  await expect(rows.getByRole('button', { name: /History/ })).toBeVisible()

  // The old price is a version of the charge, kept inactive.
  await rows.getByRole('button', { name: /History/ }).click()
  const sheet = page.getByRole('dialog')
  // At least the old price and the new one; a reused mock may hold more.
  await expect(sheet.getByText(/^\d+ versions$/)).toBeVisible()
  await expect(sheet.getByText('Current')).toBeVisible()
  await expect(sheet.getByText('History', { exact: true }).first()).toBeVisible()

  // Reverting brings the earlier price back as a new version.
  await sheet.getByRole('button', { name: 'Revert to this version' }).click()
  const confirm = page.getByRole('dialog', { name: /^Revert to the/ })
  await confirm.getByRole('button', { name: 'Revert' }).click()
  await expect(confirm).toBeHidden()
  await expect(page.getByRole('row').filter({ hasText: 'API usage' })).toContainText('0.002')
})
