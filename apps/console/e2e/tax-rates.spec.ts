import { expect, test, type Page } from '@playwright/test'

import { CatalogListPage } from './pages/catalog'

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

const isWrite = (method: string, path: RegExp) => (r: { method(): string; url(): string }) =>
  r.method() === method && path.test(new URL(r.url()).pathname)

test.describe('the tax rates list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Tax rates', searchLabel: 'Search tax rates' })

  const openRowMenu = async (page: Page, item: string) => {
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a tax rate from a dialog', async ({ page }) => {
    await page.goto('/taxes')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New tax rate' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New tax rate' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create tax rate' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name', { exact: false }).first().fill('UK VAT')
    await dialog.getByLabel('Code').fill('UKVAT')
    await dialog.getByLabel('Rate (%)').fill('20')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/taxes\/rates$/))
    await dialog.getByRole('button', { name: 'Create tax rate' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('edits a tax rate from the row menu', async ({ page }) => {
    await page.goto('/taxes')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Edit tax rate')
    const dialog = page.getByRole('dialog', { name: 'Edit tax rate' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Code').fill('USOR')
    await dialog.getByLabel('Description').fill('Updated from the dialog')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/taxes\/rates\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('renames a tax rate inline', async ({ page }) => {
    await page.goto('/taxes')
    const first = list(page).rows().first()
    await expect(first).toBeVisible({ timeout: 20_000 })

    await first.getByRole('button', { name: /^Tax rate: .*Edit$/ }).click()
    const input = first.getByRole('textbox', { name: 'Tax rate' })
    await input.fill('Renamed tax rate')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/taxes\/rates\/[^/]+$/))
    await input.press('Enter')
    await request
    await expect(first.getByRole('textbox', { name: 'Tax rate' })).toBeHidden()
  })

  test('deletes a tax rate after confirming', async ({ page }) => {
    await page.goto('/taxes')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Delete tax rate')
    const dialog = page.getByRole('dialog', { name: /^Delete / })
    await expect(dialog).toBeVisible()

    const request = page.waitForRequest(isWrite('DELETE', /\/v1\/taxes\/rates\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Delete tax rate' }).click()
    await request
    await expect(dialog).toBeHidden()
  })
})
