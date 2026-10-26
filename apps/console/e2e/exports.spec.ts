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

test.describe('exports', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Exports', searchLabel: 'Search exports' })

  test('lists scheduled exports with their bucket and status', async ({ page }) => {
    const exports = list(page)
    await page.goto('/exports')

    await expect(exports.rows().first()).toBeVisible()
    await expect(page.getByText('acme-billing').first()).toBeVisible()
    await expect(exports.rows().first()).toContainText(/Active|Paused/)
  })

  test('puts the search in the URL and survives a reload', async ({ page }) => {
    const exports = list(page)
    await page.goto('/exports')
    await expect(exports.rows().first()).toBeVisible()

    await page.getByLabel('Search exports').fill('warehouse')
    await expect(page).toHaveURL(/search=warehouse/)
    await expect(exports.rows()).toHaveCount(1)

    await page.reload()
    await expect(page.getByLabel('Search exports')).toHaveValue('warehouse')
    await expect(exports.rows()).toHaveCount(1)
  })
})

test.describe('exports flow (as V1)', () => {
  test('connects S3, creates an export on it, pauses it and runs it now', async ({ page }) => {
    await page.goto('/exports')
    await page.getByRole('button', { name: /Amazon S3/ }).click()
    await expect(page).toHaveURL(/\/exports\/s3$/)

    // A Flexprice-managed bucket needs only a name.
    await page.getByRole('button', { name: 'Add connection' }).click()
    const connect = page.getByRole('dialog')
    await connect.getByLabel(/Connection name/).fill('E2E bucket')
    await connect.getByRole('switch').click()
    await connect.getByRole('button', { name: 'Connect' }).click()
    await expect(page.getByText('E2E bucket')).toBeVisible()

    // Open the seeded customer-owned connection and add an export.
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Acme data lake' })
      .getByRole('button', { name: 'View exports' })
      .click()
    await expect(page).toHaveURL(/\/exports\/s3\/conn_s3_01$/)
    await expect(page.getByRole('heading', { name: 'Acme data lake' })).toBeVisible()
    await page.getByRole('button', { name: 'Add task' }).first().click()
    const create = page.getByRole('dialog')
    await create.getByLabel(/^Bucket/).fill('e2e-bucket')
    await create.getByRole('button', { name: 'Create export' }).click()
    await expect(page.getByText('e2e-bucket')).toBeVisible()

    // The export's page: pause, then run now; the runs tab lists the run.
    await page.getByRole('row').filter({ hasText: 'e2e-bucket' }).click()
    await expect(page.getByRole('heading', { name: 'Events export' })).toBeVisible()
    await page.getByRole('button', { name: 'Export actions' }).click()
    await page.getByRole('menuitem', { name: 'Pause export' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Pause export' }).click()
    await expect(page.getByText('Paused').first()).toBeVisible()

    await page.getByRole('button', { name: 'Run now' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Run export' }).click()
    await page.getByRole('tab', { name: 'Runs' }).click()
    await expect(page.getByText(/run_manual_/).first()).toBeVisible()
  })
})
