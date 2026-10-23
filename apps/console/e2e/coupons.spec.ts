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

test.describe('the coupons list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Coupons', searchLabel: 'Search coupons' })

  test('creates a coupon on a full page and lands on its detail', async ({ page }) => {
    await page.goto('/coupons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await page.getByRole('button', { name: 'New coupon' }).first().click()
    await expect(page).toHaveURL(/\/coupons\/new/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Create coupon' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('Launch offer')
    await page.getByLabel('Code').fill('LAUNCH10')
    await page.getByLabel('Percentage off').fill('10')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/coupons$/))
    await page.getByRole('button', { name: 'Create coupon' }).click()
    await request
    await expect(page).toHaveURL(/\/coupons\/(?!new)[^/]+$/)
  })

  test('cancel on the create page returns to the list', async ({ page }) => {
    await page.goto('/coupons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await page.getByRole('button', { name: 'New coupon' }).first().click()
    await page.getByRole('button', { name: 'Close form' }).click()
    await expect(page).toHaveURL(/\/coupons(\?.*)?$/)
  })

  test('edits a coupon in place from the Coupon details card', async ({ page }) => {
    await page.goto('/coupons')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'View coupon' }).click()
    await expect(page).toHaveURL(/\/coupons\/[^/]+$/)

    const url = page.url()
    await page.getByRole('tab', { name: 'Information' }).click()
    await page.getByRole('button', { name: 'Edit coupon details' }).click()
    await expect(page).toHaveURL(url)

    await page.getByLabel('Name', { exact: true }).fill('Renamed in place')
    const request = page.waitForRequest(isWrite('PUT', /\/v1\/coupons\/[^/]+$/))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await request
    await expect(page.getByLabel('Name', { exact: true })).toBeHidden()
  })
})
