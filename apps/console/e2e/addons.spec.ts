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

test.describe('the add-ons list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Add-ons', searchLabel: 'Search add-ons' })

  test('creates an add-on on a full page and lands on its detail', async ({ page }) => {
    await page.goto('/addons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await page.getByRole('button', { name: 'New add-on' }).first().click()
    await expect(page).toHaveURL(/\/addons\/new/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Create add-on' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByRole('textbox', { name: 'Name' }).fill('Priority support')
    await page.getByRole('textbox', { name: 'Lookup key' }).fill('priority_support')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/addons$/))
    await page.getByRole('button', { name: 'Create add-on' }).click()
    await request
    await expect(page).toHaveURL(/\/addons\/(?!new)[^/]+$/)
  })

  test('cancel on the create page returns to the list', async ({ page }) => {
    await page.goto('/addons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: 'New add-on' }).first().click()
    await page.getByRole('button', { name: 'Close form' }).click()
    await expect(page).toHaveURL(/\/addons(\?.*)?$/)
  })

  test('row Edit opens the detail page in edit mode, lookup key read-only', async ({ page }) => {
    await page.goto('/addons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit add-on' }).click()
    await expect(page).toHaveURL(/\/addons\/(?!new)[^/?]+\?edit=true/)
    await page.getByRole('button', { name: 'Edit add-on details' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Lookup key')).toHaveCount(0)

    await page.getByLabel('Description', { exact: true }).fill('Updated in place')
    const request = page.waitForRequest(isWrite('PUT', /\/v1\/addons\/[^/]+$/))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await request
    await expect(page.getByLabel('Description', { exact: true })).toBeHidden()
  })

  test('the Add-on details pencil edits in place without navigating', async ({ page }) => {
    await page.goto('/addons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'View add-on' }).click()
    await expect(page).toHaveURL(/\/addons\/[^/]+$/)

    const url = page.url()
    await page.getByRole('tab', { name: /Information/ }).click()
    await page.getByRole('button', { name: 'Edit add-on details' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(url)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toBeHidden()
  })
})
