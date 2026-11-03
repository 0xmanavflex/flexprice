import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

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

  test('creates a tax rate on its own page', async ({ page }) => {
    await page.goto('/taxes')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Add tax' }).first().click()
    await expect(page).toHaveURL(/\/taxes\/new$/)
    await expect(page.getByRole('heading', { name: 'Tax rate details' })).toBeVisible()

    await page.getByRole('button', { name: 'Create tax rate' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('UK VAT')
    await page.getByLabel('Code').fill('UKVAT')
    await page.getByLabel('Rate (%)').fill('20')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/taxes\/rates$/))
    await page.getByRole('button', { name: 'Create tax rate' }).click()
    await request
    await expect(page).toHaveURL(/\/taxes$/)
  })

  test('cancel returns to the list without saving', async ({ page }) => {
    await page.goto('/taxes/new')
    await page.getByRole('button', { name: 'Close form' }).click()
    await expect(page).toHaveURL(/\/taxes$/)
  })

  test('edits a tax rate from the row menu on its own page', async ({ page }) => {
    await page.goto('/taxes')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Edit tax rate')
    await expect(page).toHaveURL(/\/taxes\/[^/]+\/edit$/)
    await expect(page.getByRole('heading', { name: 'Edit tax rate' })).toBeVisible()

    await page.getByLabel('Code').fill('USOR')
    await page.getByLabel('Description').fill('Updated from the page')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/taxes\/rates\/[^/]+$/))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await request
    await expect(page).toHaveURL(/\/taxes$/)
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

test.describe('a tax rate detail page', () => {
  test('opens from its row, archives by status and stays editable', async ({ page }) => {
    await page.goto('/taxes')
    const rows = new CatalogListPage(page, {
      heading: 'Tax rates',
      searchLabel: 'Search tax rates',
    }).rows()
    await expect(rows.first()).toBeVisible({ timeout: 20_000 })

    await rows.first().click()
    await expect(page).toHaveURL(/\/taxes\/tax_[^/]+$/)
    await expect(page.getByRole('heading', { name: 'Tax rate details' })).toBeVisible()

    await page.getByRole('button', { name: 'Tax rate actions' }).click()
    await page.getByRole('menuitem', { name: 'Archive' }).click()
    // Archive is a status change (PUT), never a delete.
    const request = page.waitForRequest(isWrite('PUT', /\/v1\/taxes\/rates\/[^/]+$/))
    await page.getByRole('button', { name: 'Archive tax rate' }).click()
    const sent = await request
    expect(sent.postDataJSON()).toMatchObject({ tax_rate_status: 'INACTIVE' })
    expect((await sent.response())?.ok()).toBe(true)
    // The page stays, and the refreshed rate reads as archived.
    await expect(page).toHaveURL(/\/taxes\/tax_[^/]+$/)
    await expect(page.getByText('Archived', { exact: true }).first()).toBeVisible()

    // An archived rate can still be opened in Edit, to publish it again.
    await page.getByRole('button', { name: 'Tax rate actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Edit tax rate' })).toBeEnabled()
  })
})
