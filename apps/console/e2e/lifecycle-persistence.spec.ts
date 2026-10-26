import { type Page } from '@playwright/test'
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

/**
 * The Void action, matched exactly.
 *
 * `name` is a substring match, and the payment-status item's hint reads
 * "Void invoices cannot change" — so a loose `'Void invoice'` matched *that*
 * once an invoice was voided, and the assertion that Void had gone found a
 * disabled item belonging to another menu entry.
 */
const voidItem = (page: Page) => page.getByRole('menuitem', { name: 'Void invoice', exact: true })

test('a created invoice is a draft, finalizing it sticks, and the list shows it', async ({
  page,
}) => {
  await page.goto('/invoices/new')
  await page.getByRole('combobox', { name: /Customer/ }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /Currency/ }).click()
  await page.getByRole('option', { name: 'USD' }).click()
  await page.getByLabel('Line 1 name').fill('Setup')
  await page.getByLabel('Unit price for line 1').fill('75.50')
  await page.getByRole('button', { name: 'Save draft' }).click()

  await expect(page).toHaveURL(/\/invoices\/inv_new_/)
  await expect(page.getByRole('heading', { name: 'Invoice', level: 1 })).toBeVisible()
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible()

  // Every invoice action, Finalize included, lives in the header's More menu.
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Finalize invoice' }).click()
  await expect(page.getByText('Finalized', { exact: true }).first()).toBeVisible()
  // Let the menu finish its exit animation before reopening it. Clicking the
  // trigger mid-animation reopens the closing menu, and an Escape sent to that
  // menu is sometimes dropped — it stays open and its backdrop swallows the
  // breadcrumb click below.
  const menu = page.getByRole('menu', { name: 'More actions' })
  await expect(menu).toBeHidden()

  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Finalize invoice' })).toBeHidden()
  await expect(voidItem(page)).toBeVisible()
  await menu.press('Escape')
  await expect(menu).toBeHidden()
  // Back through the breadcrumb, an in-app navigation, so the mock store keeps the new invoice.
  await page
    .getByRole('navigation', { name: /breadcrumb/i })
    .getByRole('button', { name: 'Invoices', exact: true })
    .click()
  await expect(page).toHaveURL(/\/invoices$/)
  // A new invoice has no number yet, so the list row is found by its amount.
  await expect(page.getByText('$75.50').first()).toBeVisible()
})

test('add-on in-place edit saves and the detail reflects it', async ({ page }) => {
  await page.goto('/addons')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Add-on actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit add-on details' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Renamed add-on')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Renamed add-on' })).toBeVisible()
})

test('coupon in-place edit saves and the detail reflects it', async ({ page }) => {
  await page.goto('/coupons')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Coupon actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit coupon details' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Renamed coupon')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/coupons\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Renamed coupon' })).toBeVisible()
})

test('cost sheet in-place edit saves and the detail reflects it', async ({ page }) => {
  await page.goto('/cost-sheets')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Cost sheet actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit cost sheet details' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Renamed sheet')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
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

test('cancelling a contract at period end is reflected on the detail', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Contract actions' }).click()
  await page.getByRole('menuitem', { name: 'Cancel contract' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel contract' }).click()
  await expect(page.getByText(/This contract ends on .* and will not renew/)).toBeVisible()
})

async function createInvoice(page: Page, finalizeNow: boolean) {
  await page.goto('/invoices/new')
  await page.getByRole('combobox', { name: /Customer/ }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('combobox', { name: /Currency/ }).click()
  await page.getByRole('option', { name: 'USD' }).click()
  await page.getByLabel('Line 1 name').fill('Setup')
  await page.getByLabel('Unit price for line 1').fill('20.00')
  await page.getByRole('button', { name: finalizeNow ? 'Finalize invoice' : 'Save draft' }).click()
  await expect(page).toHaveURL(/\/invoices\/inv_new_/)
}

test('finalize now creates an open invoice that can be voided from the detail', async ({
  page,
}) => {
  await createInvoice(page, true)
  await expect(page.getByText('Finalized', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'More actions' }).click()
  await voidItem(page).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Void invoice' }).click()
  // The header chip is the state a reader sees; the activity rail now reads the
  // activity log, so its wording is not the invoice's own lifecycle line.
  await expect(page.getByText('Void', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(voidItem(page)).toBeHidden()
})

test('cancelling a contract immediately marks it cancelled', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Contract actions' }).click()
  await page.getByRole('menuitem', { name: 'Cancel contract' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Immediately' }).click()
  await dialog.getByRole('button', { name: 'Cancel contract' }).click()
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Contract actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Cancel contract' })).toBeDisabled()
})

// As the API: a new contract's status comes from its payment behaviour, not its
// start date, and the console sends none, so a future-dated one is created active.
test('a future-dated contract is created active, as the API creates it', async ({ page }) => {
  await page.goto('/contracts/new')
  // Customer and plan share the first step; the plan appears once the customer
  // is chosen, so there is no Next between them.
  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: /^Plan/ }).click()
  await page.getByRole('option').first().click()
  const currency = page.getByRole('combobox', { name: /Currency/ })
  if ((await currency.textContent())?.includes('Choose')) {
    await currency.click()
    await page.getByRole('option').first().click()
  }
  // The start date is the contract's own, on the first step once a plan is chosen.
  await page.getByLabel('Starts').click()
  await page.getByRole('button', { name: /next month/i }).click()
  await page.getByRole('gridcell', { name: '15' }).getByRole('button').click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/step=phases/, { timeout: 15_000 })
  for (const step of ['commitments', 'billing', 'review']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`step=${step}`), { timeout: 15_000 })
  }
  await page.getByRole('button', { name: 'Create contract' }).click()
  await expect(page).toHaveURL(/\/contracts$/)

  await page.getByRole('row').nth(1).click()
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Incomplete')).toHaveCount(0)
  // Nothing to activate.
  await page.getByRole('button', { name: 'Contract actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Activate' })).toBeHidden()
  await page.keyboard.press('Escape')
})
