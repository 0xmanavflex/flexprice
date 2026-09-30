import { expect, test } from '@playwright/test'

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
  test('adds then edits a charge in place', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()

    await page
      .getByRole('button', { name: /^Add charges$/ })
      .first()
      .click()
    await expect(plan.main.getByRole('heading', { name: 'Add charge' })).toBeVisible()
    await plan.main.getByLabel('Amount').fill('49.00')
    await plan.main.getByRole('button', { name: /^Create charge$/ }).click()
    await expect(plan.main.getByRole('button', { name: 'Cancel' })).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.main.getByRole('heading', { name: 'Edit charge' })).toBeVisible()
    await expect(plan.main.getByText('Changing the price creates a new version')).toBeVisible()
    await plan.main.getByRole('button', { name: 'Save new version' }).click()
    await expect(plan.main.getByRole('button', { name: 'Cancel' })).toBeHidden()
  })

  test('adds then edits an entitlement', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    await plan.section('Entitlements')

    await page.getByRole('button', { name: 'Add entitlement' }).first().click()
    await expect(plan.main.getByRole('heading', { name: 'Add entitlement' })).toBeVisible()
    await plan.main.getByRole('combobox', { name: 'Feature' }).click()
    await page.getByRole('option').first().click()
    await plan.main.getByRole('button', { name: /^Create entitlement$/ }).click()
    await expect(plan.main.getByRole('button', { name: 'Cancel' })).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.main.getByRole('heading', { name: 'Edit entitlement' })).toBeVisible()
    await plan.main.getByRole('button', { name: /^Save/ }).click()
    await expect(plan.main.getByRole('button', { name: 'Cancel' })).toBeHidden()
  })

  test('adds then edits a credit grant', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    await plan.section('Credit Grants')

    await page
      .getByRole('button', { name: /^Add credit grant$/ })
      .first()
      .click()
    await expect(plan.main.getByRole('heading', { name: 'Add credit grant' })).toBeVisible()
    await plan.main.getByLabel('Name').fill('Welcome credits')
    await plan.main.getByLabel('Credits').fill('500')
    await plan.main.getByRole('button', { name: 'Create credit grant' }).click()
    await expect(plan.main.getByRole('button', { name: 'Cancel' })).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.main.getByRole('heading', { name: 'Edit credit grant' })).toBeVisible()
    await plan.main.getByLabel('Name').fill('Renamed grant')
    await plan.main.getByRole('button', { name: 'Save changes' }).click()
    await expect(plan.main.getByRole('button', { name: 'Cancel' })).toBeHidden()
  })

  test('creates a plan on a full page, staging a charge', async ({ page }) => {
    await page.goto('/plans/new')
    await expect(page.getByRole('heading', { name: 'Create plan' })).toBeVisible()
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

  test('opens the edit page from the plan menu', async ({ page }) => {
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
