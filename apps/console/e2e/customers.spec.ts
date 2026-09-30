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

test.describe('the customers list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Customers', searchLabel: 'Search customers' })

  const openRowMenu = async (page: Page, item: string) => {
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a customer from a dialog', async ({ page }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New customer' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New customer' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create customer' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name', { exact: false }).first().fill('Acme Robotics')
    await dialog.getByLabel('External ID').fill('acme_robotics')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/customers$/))
    await dialog.getByRole('button', { name: 'Create customer' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('edits a customer from the row menu', async ({ page }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Edit customer')
    const dialog = page.getByRole('dialog', { name: 'Edit customer' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Phone').fill('+1 555 0100')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/customers$/))
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('renames a customer inline', async ({ page }) => {
    await page.goto('/customers')
    const first = list(page).rows().first()
    await expect(first).toBeVisible({ timeout: 20_000 })

    await first.getByRole('button', { name: /^Customer: .*Edit$/ }).click()
    const input = first.getByRole('textbox', { name: 'Customer' })
    await input.fill('Renamed customer')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/customers$/))
    await input.press('Enter')
    await request
    await expect(first.getByRole('textbox', { name: 'Customer' })).toBeHidden()
  })

  test('deletes a customer after confirming', async ({ page }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Delete customer')
    const dialog = page.getByRole('dialog', { name: /^Delete / })
    await expect(dialog).toBeVisible()

    const request = page.waitForRequest(isWrite('DELETE', /\/v1\/customers\/[^/]+$/))
    await dialog.getByRole('button', { name: 'Delete customer' }).click()
    await request
    await expect(dialog).toBeHidden()
  })
})
