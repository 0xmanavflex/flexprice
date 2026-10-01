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

  test('creates a customer on its own page and lands on its detail', async ({ page }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New customer' }).first().click()
    await expect(page).toHaveURL(/\/customers\/new/)
    await expect(page.getByRole('heading', { level: 1, name: 'Create customer' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Step 1 is gated on its own fields.
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('Acme Robotics')
    await page.getByLabel('External ID').fill('acme_robotics')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/step=address/)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/step=additional/)

    const request = page.waitForRequest(isWrite('POST', /\/v1\/customers$/))
    await page.getByRole('button', { name: 'Create customer' }).click()
    await request
    await expect(page).toHaveURL(/\/customers\/(?!new)[^/]+$/)
  })

  test('edits a customer on its own prepopulated page', async ({ page }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await openRowMenu(page, 'Edit customer')
    await expect(page).toHaveURL(/\/customers\/[^/]+\/edit/)
    await expect(page.getByRole('heading', { level: 1, name: /^Edit / })).toBeVisible()
    await expect(page.getByLabel('Name', { exact: false }).first()).not.toHaveValue('', {
      timeout: 20_000,
    })

    await page.getByLabel('Phone').fill('+1 555 0100')

    const request = page.waitForRequest(isWrite('PUT', /\/v1\/customers$/))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await request
    await expect(page).toHaveURL(/\/customers\/(?!new)[^/]+$/)
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

test.describe('a customer detail page', () => {
  const openFirstCustomer = async (page: Page) => {
    await page.goto('/customers')
    const first = new CatalogListPage(page, {
      heading: 'Customers',
      searchLabel: 'Search customers',
    })
      .rows()
      .first()
    await expect(first).toBeVisible({ timeout: 20_000 })
    await first.getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'View customer' }).click()
    await expect(page).toHaveURL(/\/customers\/[^/]+$/)
  }

  test('edits phone inline on the Information tab', async ({ page }) => {
    await openFirstCustomer(page)
    await page.getByRole('tab', { name: 'Information' }).click()

    await page.getByRole('button', { name: 'Edit customer' }).click()
    await page.getByRole('textbox', { name: 'Phone' }).fill('+1 555 0199')
    const request = page.waitForRequest(isWrite('PUT', /\/v1\/customers$/))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await request
  })

  test('opens the billing edit page from the header', async ({ page }) => {
    await openFirstCustomer(page)
    await page.getByRole('button', { name: 'Customer actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit billing details' }).click()
    await expect(page).toHaveURL(/\/customers\/[^/]+\/edit/)
  })

  test('creates a subscription inside the Subscriptions section', async ({ page }) => {
    await openFirstCustomer(page)
    await page.getByRole('button', { name: 'Customer actions' }).click()
    await page.getByRole('menuitem', { name: 'Create subscription' }).click()

    // Same page, same customer, Subscriptions tab: nothing navigated away.
    await expect(page).toHaveURL(/\/customers\/[^/]+\?tab=subscriptions/)
    await expect(page.getByRole('heading', { level: 2, name: 'Create subscription' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Subscriptions', exact: true }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Customer actions' }).click()
    await page.getByRole('menuitem', { name: 'Create subscription' }).click()
    for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create Subscription', exact: true }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Subscriptions', exact: true }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/customers\/[^/]+\?tab=subscriptions/)
  })
})
