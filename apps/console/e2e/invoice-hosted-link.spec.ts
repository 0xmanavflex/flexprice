import { expect, test } from '@playwright/test'

/**
 * The invoice's hosted link — `hosted_invoice_url`, the page its customer
 * receives — from the list's row menu and the invoice page's More menu.
 * The mocks answer it for every finalized invoice, as the API does.
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* private mode */
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
})

const HOSTED = /^https:\/\/invoice-dev\.flexprice\.io\/in\/hit_inv_[^/]+\.demo-signature$/

test('opens the hosted invoice from the list row menu, in a new tab', async ({ page, context }) => {
  await page.goto('/invoices?status=finalized')
  const row = page.getByRole('row').nth(1)
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.getByRole('button', { name: 'Row actions' }).click()
  // The tab opens on the click and is pointed at the link once it arrives.
  const tab = context.waitForEvent('page')
  await page.getByRole('menuitem', { name: 'Open hosted invoice' }).click()
  const opened = await tab
  await expect.poll(() => opened.url(), { timeout: 15_000 }).toMatch(HOSTED)
})

test('copies the hosted invoice link from the list row menu', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/invoices?status=finalized')
  const row = page.getByRole('row').nth(1)
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.getByRole('button', { name: 'Row actions' }).click()
  await page.getByRole('menuitem', { name: 'Copy hosted invoice link' }).click()
  await expect(page.getByText('Hosted invoice link copied')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(HOSTED)
})

test('the invoice page opens and copies its hosted link from More', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/invoices?status=finalized')
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await expect(page).toHaveURL(/\/invoices\/[^/?]+$/)

  await page.getByRole('button', { name: 'More actions' }).click()
  const open = page.getByRole('menuitem', { name: /Open hosted invoice/ })
  await expect(open).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  const tab = context.waitForEvent('page')
  await open.click()
  await expect.poll(async () => (await tab).url(), { timeout: 15_000 }).toMatch(HOSTED)

  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: /Copy hosted invoice link/ }).click()
  await expect(page.getByText('Hosted invoice link copied')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(HOSTED)
})

test('a draft offers no hosted link', async ({ page }) => {
  await page.goto('/invoices?status=draft')
  const row = page.getByRole('row').nth(1)
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.getByRole('button', { name: 'Row actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Finalize' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Open hosted invoice' })).toHaveCount(0)
})
