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

test.describe('the cost sheets list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Cost sheets', searchLabel: 'Search cost sheets' })

  const openRowMenu = async (page: Page, item: string) => {
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a cost sheet on a full page and lands on its detail', async ({ page }) => {
    await page.goto('/cost-sheets')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await page.getByRole('button', { name: 'New cost sheet' }).first().click()
    await expect(page).toHaveURL(/\/cost-sheets\/new/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Create cost sheet' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('Inference costs')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/costs$/))
    await page.getByRole('button', { name: 'Create cost sheet' }).click()
    await request
    await expect(page).toHaveURL(/\/cost-sheets\/(?!new)[^/]+$/)
  })

  test('cancel on the create page returns to the list', async ({ page }) => {
    await page.goto('/cost-sheets')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: 'New cost sheet' }).first().click()
    await expect(page).toHaveURL(/\/cost-sheets\/new/)
    await page.getByRole('button', { name: 'Close form' }).click()
    await expect(page).toHaveURL(/\/cost-sheets(\?.*)?$/)
  })

  test('row Edit opens the detail page in edit mode', async ({ page }) => {
    await page.goto('/cost-sheets')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await openRowMenu(page, 'Edit cost sheet')
    await expect(page).toHaveURL(/\/cost-sheets\/(?!new)[^/?]+\?edit=true/)
    await page.getByRole('button', { name: 'Edit cost sheet details' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()

    await page.getByLabel('Description', { exact: true }).fill('Updated in place')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/costs\/[^/]+$/))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await request
    await expect(page.getByLabel('Description', { exact: true })).toBeHidden()
  })

  test('deletes a cost sheet after confirming', async ({ page }) => {
    await page.goto('/cost-sheets')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await openRowMenu(page, 'Delete cost sheet')
    const dialog = page.getByRole('dialog', { name: /^Delete / })
    await expect(dialog).toBeVisible()

    const request = page.waitForRequest(isWrite('DELETE', /\/v1\/costs\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Delete cost sheet' }).click()
    await request
    await expect(dialog).toBeHidden()
  })
})
