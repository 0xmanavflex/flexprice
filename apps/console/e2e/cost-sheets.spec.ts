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

test.describe('the cost sheets list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Cost sheets', searchLabel: 'Search cost sheets' })

  const openRowMenu = async (page: Page, item: string) => {
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a cost sheet from a dialog', async ({ page }) => {
    await page.goto('/cost-sheets')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New cost sheet' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New cost sheet' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create cost sheet' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name', { exact: false }).first().fill('Inference costs')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/costs$/))
    await dialog.getByRole('button', { name: 'Create cost sheet' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('edits a cost sheet from the row menu', async ({ page }) => {
    await page.goto('/cost-sheets')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Edit cost sheet')
    const dialog = page.getByRole('dialog', { name: 'Edit cost sheet' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Description').fill('Updated from the dialog')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/costs\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('renames a cost sheet inline', async ({ page }) => {
    await page.goto('/cost-sheets')
    const first = list(page).rows().first()
    await expect(first).toBeVisible({ timeout: 20_000 })

    await first.getByRole('button', { name: /^Cost sheet: .*Edit$/ }).click()
    const input = first.getByRole('textbox', { name: 'Cost sheet' })
    await input.fill('Renamed cost sheet')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/costs\/[^/]+$/))
    await input.press('Enter')
    await request
    await expect(first.getByRole('textbox', { name: 'Cost sheet' })).toBeHidden()
  })

  test('deletes a cost sheet after confirming', async ({ page }) => {
    await page.goto('/cost-sheets')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Delete cost sheet')
    const dialog = page.getByRole('dialog', { name: /^Delete / })
    await expect(dialog).toBeVisible()

    const request = page.waitForRequest(isWrite('DELETE', /\/v1\/costs\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Delete cost sheet' }).click()
    await request
    await expect(dialog).toBeHidden()
  })
})
