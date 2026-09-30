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

test.describe('the coupons list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Coupons', searchLabel: 'Search coupons' })

  test('creates a coupon from a dialog', async ({ page }) => {
    await page.goto('/coupons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New coupon' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New coupon' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create coupon' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name', { exact: false }).first().fill('Launch offer')
    await dialog.getByLabel('Code').fill('LAUNCH10')
    await dialog.getByLabel('Percentage off').fill('10')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/coupons$/))
    await dialog.getByRole('button', { name: 'Create coupon' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('renames a coupon inline', async ({ page }) => {
    await page.goto('/coupons')
    const first = list(page).rows().first()
    await expect(first).toBeVisible({ timeout: 20_000 })

    await first.getByRole('button', { name: /^Coupon: .*Edit$/ }).click()
    const input = first.getByRole('textbox', { name: 'Coupon' })
    await input.fill('Renamed coupon')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/coupons\/[^/]+$/))
    await input.press('Enter')
    await request
    await expect(first.getByRole('textbox', { name: 'Coupon' })).toBeHidden()
  })
})
