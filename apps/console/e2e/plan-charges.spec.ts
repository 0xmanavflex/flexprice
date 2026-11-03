import { expect, test } from './fixtures'

import { PlanDetailPage } from './pages/plan-charges'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* the guard falls back to sign-in */
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
})

test.describe('plan charges, entitlements and credit grants', () => {
  test('keeps pricing on Information and jumps back to its Overview section', async ({ page }) => {
    await page.goto('/plans')
    await page.getByRole('row').nth(1).click()
    await expect(page.getByRole('tab', { name: 'Information' })).toBeVisible()
    await page.getByRole('tab', { name: 'Information' }).click()
    await expect(page).toHaveURL(/[?&]tab=information/)
    await page.reload()
    await expect(page.getByRole('complementary', { name: 'Plan preview' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Plan details', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Overview' }).click()
    await page.getByRole('button', { name: 'Add charge', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: /Fixed/ }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.getByLabel('Amount').fill('49.00')
    await dialog.getByRole('button', { name: 'Create charge', exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('tab', { name: 'Information' }).click()
    // The preview's price goes to its table, Charges.
    await page
      .getByRole('complementary', { name: 'Plan preview' })
      .getByRole('link', { name: /\/month/ })
      .click()
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('heading', { name: 'Charges', exact: true })).toBeFocused()
  })

  test('adds then edits a charge in place', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()

    await page
      .getByRole('button', { name: /^Add charge$/ })
      .first()
      .click()
    await expect(plan.main.getByRole('heading', { name: 'Add charge' })).toBeVisible()
    // The type step comes first: Fixed is preselected.
    await plan.main.getByRole('radio', { name: /Fixed/ }).click()
    await plan.main.getByRole('button', { name: 'Continue' }).click()
    await plan.main.getByLabel('Amount').fill('49.00')
    await plan.main.getByRole('button', { name: /^Create charge$/ }).click()
    await expect(plan.main).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.main.getByRole('heading', { name: 'Edit charge' })).toBeVisible()
    await expect(plan.main.getByText('Changing the price creates a new version')).toBeVisible()
    await plan.main.getByRole('button', { name: 'Save new version' }).click()
    await expect(plan.main).toBeHidden()
  })

  test('a repriced charge keeps its old price as an inactive version', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    const table = page.getByRole('region', { name: 'Charges table' })
    const rows = table.getByRole('row')
    // Wait for real rows, not the loading skeleton.
    const firstActions = rows.nth(1).getByRole('button', { name: /^Actions for/ })
    await expect(firstActions).toBeVisible()
    const before = await rows.count()
    // Follow one charge by name: other journeys add charges to this plan.
    const name = ((await firstActions.getAttribute('aria-label')) ?? '').replace(
      /^Actions for /,
      '',
    )
    const row = rows.filter({ has: page.getByRole('button', { name: `Actions for ${name}` }) })

    // Two edits with known prices, so the revert has a known price to return to.
    const reprice = async (amount: string) => {
      await row.getByRole('button', { name: `Actions for ${name}` }).click()
      await page.getByRole('menuitem', { name: 'Edit' }).click()
      await expect(plan.main.getByRole('heading', { name: 'Edit charge' })).toBeVisible()
      await plan.main.getByLabel('Amount').fill(amount)
      await plan.main.getByRole('button', { name: 'Save new version' }).click()
      await expect(plan.main).toBeHidden()
      await expect(row).toContainText(amount)
    }
    await reprice('123.45')
    await reprice('150.00')

    // Still one row per charge: the old prices are history, not extra rows and not gone.
    await expect(rows).toHaveCount(before)
    // Opening the sheet reads the charge's versions from the history API.
    const historyRead = page.waitForRequest(/\/prices\/[^/]+\/history$/)
    await row.getByRole('button', { name: /History/ }).click()
    await historyRead
    const sheet = page.getByRole('dialog')
    // At least the old price and the new one; a reused mock may hold more.
    await expect(sheet.getByText(/^\d+ versions$/)).toBeVisible()
    // The old price's tag, not the History heading ("History · N versions").
    await expect(sheet.getByText('History', { exact: true }).first()).toBeVisible()
  })

  test('adds then edits an entitlement', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    await plan.section('Entitlements')

    await page.getByRole('button', { name: 'Add entitlement' }).first().click()
    await expect(plan.main.getByRole('heading', { name: 'Add entitlement' })).toBeVisible()
    await plan.main.getByRole('combobox', { name: 'Feature' }).click()
    await page.getByRole('option').first().click()
    // A metered feature needs an allowance; a boolean one has no Value field.
    // Which kind sorts first is not this test's business, so it fills the
    // field when the chosen feature asks for one.
    const value = plan.main.getByRole('textbox', { name: 'Value' })
    if (await value.isVisible()) await value.fill('25')
    await plan.main.getByRole('button', { name: /^Create entitlement$/ }).click()
    await expect(plan.main).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.main.getByRole('heading', { name: 'Edit entitlement' })).toBeVisible()
    await plan.main.getByRole('button', { name: /^Save/ }).click()
    await expect(plan.main).toBeHidden()
  })

  test('adds then edits a credit grant', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    await plan.section('Credit grants')

    await page
      .getByRole('button', { name: /^Add grant$/ })
      .first()
      .click()
    await expect(plan.main.getByRole('heading', { name: 'Add credit grant' })).toBeVisible()
    await plan.main.getByLabel('Name').fill('Welcome credits')
    await plan.main.getByLabel('Credits').fill('500')
    await plan.main.getByRole('button', { name: 'Create credit grant' }).click()
    await expect(plan.main).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.main.getByRole('heading', { name: 'Edit credit grant' })).toBeVisible()
    await plan.main.getByLabel('Name').fill('Renamed grant')
    await plan.main.getByRole('button', { name: 'Save changes' }).click()
    await expect(plan.main).toBeHidden()
  })

  test('creates a plan on a full page, staging a charge', async ({ page }) => {
    await page.goto('/plans/new')
    await expect(page.getByRole('heading', { name: 'Plan details' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByLabel(/^Name/).fill('Scale')
    await page.getByRole('button', { name: /^Next/ }).click()
    await expect(page).toHaveURL(/step=charges/)

    await page.getByRole('button', { name: 'Add charge' }).first().click()
    await page.getByLabel('Amount').fill('99.00')
    await page.getByRole('button', { name: 'Add charge' }).last().click()
    await expect(page.getByRole('button', { name: /^Remove / })).toBeVisible()
  })

  test('edits a plan on its own page, prepopulated', async ({ page }) => {
    await page.goto('/plans/plan_synth_0000/edit')
    await expect(page.getByRole('heading', { name: /^Edit / })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByLabel(/^Name/)).not.toHaveValue('')
  })

  test('the Plan details pencil edits in place', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    const url = page.url()
    await page.getByRole('tab', { name: 'Information' }).click()
    await page.getByRole('button', { name: 'Edit plan details' }).click()
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Description' }).fill('edited in place')
    const request = page.waitForRequest(
      (r) => r.method() === 'PUT' && /\/v1\/plans\//.test(r.url()),
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await request
    await expect(page).not.toHaveURL(/\/edit/)
    expect(page.url()).toContain(new URL(url).pathname)
  })

  test('opens the stepped edit page from the Edit details menu item', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit details' }).click()
    await expect(page).toHaveURL(/\/plans\/plan_synth_0000\/edit$/)
  })

  test('starts a plan from the list on the create page', async ({ page }) => {
    await page.goto('/plans')
    await page.getByRole('button', { name: 'New plan' }).first().click()
    await expect(page).toHaveURL(/\/plans\/new/)
  })
})
