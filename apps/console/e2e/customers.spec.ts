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

  test('opens the customer portal from the row menu, in a new tab', async ({ page, context }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })
    const [portal] = await Promise.all([
      context.waitForEvent('page'),
      openRowMenu(page, 'Open customer portal'),
    ])
    // The session token arrives in the link and is moved out of the address bar on load.
    await expect(portal).toHaveURL(/\/p(\?|$)/)
    await expect(portal.getByText('Payment methods')).toBeVisible({ timeout: 20_000 })
    await expect(portal).not.toHaveURL(/token=/)
  })

  test('the row menu opens the portal but does not copy its link', async ({ page }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Open customer portal' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy portal link' })).toHaveCount(0)
  })

  test('creates a customer on its own page and lands on its detail', async ({ page }) => {
    await page.goto('/customers')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'New customer' }).first().click()
    await expect(page).toHaveURL(/\/customers\/new/)
    await expect(page.getByRole('heading', { name: 'Customer details' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Submit is gated on the required fields.
    await page.getByRole('button', { name: 'Create customer' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()
    await expect(page).toHaveURL(/\/customers\/new/)

    // Only the essentials are on show; no copyable ID chip on a record that has no ID yet.
    await expect(page.getByRole('button', { name: /Copy ID/ })).toHaveCount(0)
    await expect(page.getByLabel('Address line 1')).toBeHidden()
    // Phone is not supported on create.
    await expect(page.getByLabel('Phone')).toHaveCount(0)

    await page.getByLabel('Name', { exact: false }).first().fill('Acme Robotics')
    // The external ID is filled from the name until you type your own.
    await expect(page.getByLabel('External ID')).toHaveValue('cust-acme-robotics')
    await page.getByLabel('External ID').fill('acme_robotics')

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

    await page.getByLabel('City').fill('London')

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

  test('unlinking from Related refreshes both the rail and header', async ({ page }) => {
    await openFirstCustomer(page)
    // Integration links are managed on the Information tab; the overview's
    // Related card links to the customer's invoices instead.
    await page.getByRole('tab', { name: 'Information' }).click()
    const rail = page.getByRole('region', { name: 'Related', exact: true })
    const mapping = rail.getByRole('button', { name: /^Manage .+ integration$/ }).first()
    await expect(mapping).toBeVisible()
    const label = await mapping.getAttribute('aria-label')
    const provider = label!.replace(/^Manage /, '').replace(/ integration$/, '')
    await expect(
      page.getByRole('button', { name: `${provider} integration`, exact: true }),
    ).toBeVisible()
    await mapping.click()
    await page.getByRole('menuitem', { name: `Unlink ${provider}`, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: `Unlink ${provider}?`, exact: true })
    const request = page.waitForRequest(isWrite('DELETE', /\/v1\/integrations\/link$/))
    await dialog.getByRole('button', { name: 'Unlink', exact: true }).click()
    await request
    await expect(dialog).toBeHidden()
    await expect(
      rail.getByRole('button', { name: `Manage ${provider} integration`, exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: `${provider} integration`, exact: true }),
    ).toHaveCount(0)
  })

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
    await page.getByRole('menuitem', { name: 'Edit customer' }).click()
    await expect(page).toHaveURL(/\/customers\/[^/]+\/edit/)
  })

  test('copies the customer portal link from the header menu', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openFirstCustomer(page)
    await page.getByRole('button', { name: 'Customer actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Open customer portal' })).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Copy portal link' }).click()
    await expect(page.getByText('Customer portal link copied')).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/\/p\?token=demo-/)
  })

  test('refreshes the Events tab on demand', async ({ page }) => {
    await openFirstCustomer(page)
    await page.getByRole('tab', { name: 'Events' }).click()
    const refresh = page.getByRole('button', { name: 'Refresh' })
    await expect(refresh).toBeEnabled()
    const reread = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/events/query'),
    )
    await refresh.click()
    await reread
  })

  test('pushes the customer to Stripe from the related integration', async ({ page }) => {
    await openFirstCustomer(page)
    await page.getByRole('tab', { name: 'Information' }).click()
    await page.getByRole('button', { name: 'Manage Stripe integration' }).click()
    const sync = page.waitForRequest(
      (request) => request.url().endsWith('/integrations/sync') && request.method() === 'POST',
    )
    await page.getByRole('menuitem', { name: 'Push to Stripe' }).click()
    const body = (await sync).postDataJSON() as Record<string, unknown>
    expect(body).toMatchObject({ entity_type: 'customer', method: 'push' })
    await expect(page.getByText('Pushing customer to Stripe')).toBeVisible()
  })
})
