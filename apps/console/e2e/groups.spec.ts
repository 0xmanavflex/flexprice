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

test.describe('the groups list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Tags', searchLabel: 'Search tags' })

  const openRowMenu = async (page: Page, item: string) => {
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a group on its own page', async ({ page }) => {
    await page.goto('/groups')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New tag' }).first().click()
    await expect(page).toHaveURL(/\/groups\/new$/)
    await expect(page.getByRole('heading', { name: 'Tag details' })).toBeVisible()

    await page.getByRole('button', { name: 'Create tag' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('EU region')
    await page.getByLabel('Lookup key').fill('eu-region')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/groups$/))
    await page.getByRole('button', { name: 'Create tag' }).click()
    await request
    await expect(page).not.toHaveURL(/\/groups\/new$/)
  })

  test('cancel returns to the list without saving', async ({ page }) => {
    await page.goto('/groups/new')
    await page.getByRole('button', { name: 'Close form' }).click()
    await expect(page).toHaveURL(/\/groups$/)
  })

  test('deletes a group after confirming', async ({ page }) => {
    await page.goto('/groups')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Delete tag')
    const dialog = page.getByRole('dialog', { name: /^Delete / })
    await expect(dialog).toBeVisible()

    const request = page.waitForRequest(isWrite('DELETE', /\/v1\/groups\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Delete tag' }).click()
    await request
    await expect(dialog).toBeHidden()
  })
})
