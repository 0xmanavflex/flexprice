import { expect, test } from '@playwright/test'

import { PlanDetailPage } from './pages/plan-charges'

test.beforeEach(async ({ context }) => {
  await context.addInitScript((value) => {
    try {
      window.localStorage.setItem('flexprice.session', value)
    } catch {
      /* the guard falls back to sign-in */
    }
  }, JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }))
})

test.describe('plan charges, entitlements and credit grants', () => {
  test('adds then edits a charge in dialogs', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()

    await page.getByRole('button', { name: /^Add charges$/ }).first().click()
    await expect(plan.dialog.getByRole('heading', { name: 'Add charge' })).toBeVisible()
    await plan.dialog.getByLabel('Amount').fill('49.00')
    await plan.dialog.getByRole('button', { name: /^Add charge$|^Create/ }).click()
    await expect(plan.dialog).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.dialog.getByRole('heading', { name: 'Edit charge' })).toBeVisible()
    await expect(plan.dialog.getByText('Changing the price creates a new version')).toBeVisible()
    await plan.dialog.getByRole('button', { name: 'Save new version' }).click()
    await expect(plan.dialog).toBeHidden()
  })

  test('adds then edits an entitlement', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    await plan.section('Entitlements')

    await page.getByRole('button', { name: 'Add entitlement' }).first().click()
    await expect(plan.dialog.getByRole('heading', { name: 'Add entitlement' })).toBeVisible()
    await plan.dialog.getByRole('combobox', { name: 'Feature' }).click()
    await page.getByRole('option').first().click()
    await plan.dialog.getByRole('button', { name: /^Create/ }).click()
    await expect(plan.dialog).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.dialog.getByRole('heading', { name: 'Edit entitlement' })).toBeVisible()
    await plan.dialog.getByRole('button', { name: /^Save/ }).click()
    await expect(plan.dialog).toBeHidden()
  })

  test('adds then edits a credit grant', async ({ page }) => {
    const plan = new PlanDetailPage(page)
    await plan.open()
    await plan.section('Credit Grants')

    await page.getByRole('button', { name: /^Add credit grant$/ }).first().click()
    await expect(plan.dialog.getByRole('heading', { name: 'Add credit grant' })).toBeVisible()
    await plan.dialog.getByLabel('Name').fill('Welcome credits')
    await plan.dialog.getByLabel('Credits').fill('500')
    await plan.dialog.getByRole('button', { name: 'Create credit grant' }).click()
    await expect(plan.dialog).toBeHidden()

    await plan.chooseRowAction(0, 'Edit')
    await expect(plan.dialog.getByRole('heading', { name: 'Edit credit grant' })).toBeVisible()
    await plan.dialog.getByLabel('Name').fill('Renamed grant')
    await plan.dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(plan.dialog).toBeHidden()
  })
})
