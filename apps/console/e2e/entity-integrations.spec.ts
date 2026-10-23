import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    localStorage.setItem(
      'flexprice.session',
      JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
    ),
  )
})

test('invoice mapping stays consistent across Related, header and list', async ({ page }) => {
  await page.goto('/invoices')
  await expect(page.getByRole('columnheader', { name: 'Integrations' })).toBeVisible()
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Link integration', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Link an integration' })
  await dialog.getByLabel('Invoice ID at the provider').fill('external_invoice_mapping')
  await dialog.getByRole('button', { name: 'Link', exact: true }).click()
  await expect(dialog).toBeHidden()
  const related = page.getByRole('region', { name: 'Related', exact: true })
  await expect(related.getByRole('button', { name: /ID external_invoice_mapping$/ })).toBeVisible()
  const manage = related.getByRole('button', { name: /^Manage .* integration$/ })
  const provider = (await manage.getAttribute('aria-label'))!
    .replace(/^Manage /, '')
    .replace(/ integration$/, '')
  await expect(
    page.getByRole('button', { name: `${provider} integration`, exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Invoices', exact: true }).first().click()
  await expect(page.getByLabel(/invoice ID external_invoice_mapping/)).toBeVisible()
  await page
    .getByRole('row')
    .filter({ has: page.getByLabel(/invoice ID external_invoice_mapping/) })
    .click()
  await page.getByRole('button', { name: /^Manage .* integration$/ }).click()
  await page.getByRole('menuitem', { name: /^Unlink / }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Unlink', exact: true }).click()
  await expect(page.getByText('external_invoice_mapping', { exact: true })).toHaveCount(0)
})

test('Plan links from the overflow and shows mappings beside metadata', async ({ page }) => {
  await page.goto('/plans')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Link integration', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Link an integration' })
  await dialog.getByLabel('Plan ID at the provider').fill('external_plan_mapping')
  await dialog.getByRole('button', { name: 'Link', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('tab', { name: 'Information', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'Related', exact: true })
      .getByRole('button', { name: /ID external_plan_mapping$/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: /^Manage .* integration$/ }).click()
  await page.getByRole('menuitem', { name: /^Unlink / }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Unlink', exact: true }).click()
  await expect(page.getByText('No linked integrations.')).toBeVisible()
})
