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

test.describe('the groups list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Groups', searchLabel: 'Search groups' })

  const openRowMenu = async (page: Page, item: string) => {
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a group from a dialog', async ({ page }) => {
    await page.goto('/groups')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New group' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New group' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create group' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name', { exact: false }).first().fill('EU region')
    await dialog.getByLabel('Lookup key').fill('eu-region')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/groups$/))
    await dialog.getByRole('button', { name: 'Create group' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('deletes a group after confirming', async ({ page }) => {
    await page.goto('/groups')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Delete group')
    const dialog = page.getByRole('dialog', { name: /^Delete / })
    await expect(dialog).toBeVisible()

    const request = page.waitForRequest(isWrite('DELETE', /\/v1\/groups\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Delete group' }).click()
    await request
    await expect(dialog).toBeHidden()
  })
})
