import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

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

/**
 * Editing an invoice completely, as V1 does: status, payment status, due date,
 * discounts, metadata and lines in one save.
 *
 * A draft changes in place. A finalized invoice keeps its id for its fields,
 * but a line change makes the API void it and carry the edit onto a draft copy
 * — so the page asks first, and then opens the copy.
 */
async function openEdit(page: Page, status: 'draft' | 'finalized') {
  await page.goto(`/invoices?status=${status}`)
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await expect(page).toHaveURL(/\/invoices\/[^/?]+/)
  const id = new URL(page.url()).pathname.split('/')[2] ?? ''
  await page.goto(`/invoices/${id}/edit`)
  await expect(page.getByRole('heading', { name: /^Edit / })).toBeVisible()
  return id
}

test('opens on the invoice as it is, with nothing to save yet', async ({ page }) => {
  await openEdit(page, 'draft')
  await expect(page.getByLabel('Invoice status')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add item' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add key' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('cancel goes back without saving', async ({ page }) => {
  const id = await openEdit(page, 'draft')
  let sawWrite = false
  // `/search` and `/activity` are POST reads (the invoice page lists its
  // activity rail after the redirect), not writes.
  page.on('request', (r) => {
    if (r.method() !== 'GET' && !/\/(search|activity)$/.test(new URL(r.url()).pathname))
      sawWrite = true
  })
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(new RegExp(`/invoices/${id}$`))
  expect(sawWrite).toBe(false)
})

test('a draft line is renamed in place', async ({ page }) => {
  const id = await openEdit(page, 'draft')
  await page.getByPlaceholder('What this line charges for').first().fill('Renamed line')

  const modify = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/modify/execute'),
  )
  await page.getByRole('button', { name: 'Save changes' }).click()
  expect((await modify).status()).toBe(200)
  await expect(page).toHaveURL(new RegExp(`/invoices/${id}$`))
})

test('a finalized invoice asks before its lines replace it, then opens the draft copy', async ({
  page,
}) => {
  const id = await openEdit(page, 'finalized')
  await expect(page.getByText('This invoice is finalized')).toBeVisible()

  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByPlaceholder('What this line charges for').last().fill('Onboarding')
  await page.getByPlaceholder('0.00').last().fill('250')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await page.getByRole('button', { name: 'Void and create draft' }).click()
  await expect(page).not.toHaveURL(new RegExp(`/invoices/${id}(/edit)?$`))
  await expect(page.getByText('Onboarding')).toBeVisible()
})
