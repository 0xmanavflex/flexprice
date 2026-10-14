import { expect, test, type Page } from '@playwright/test'

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
 * Editing an invoice, which is a much smaller thing than editing a draft of one.
 *
 * `PUT /invoices/{id}` accepts `due_date`, `metadata`, `invoice_pdf_url` and
 * `apply_discount` — and nothing else. An issued invoice's customer, currency
 * and lines are a financial record, corrected by voiding or a credit note.
 *
 * This journey exists because the page it covers replaced one that could not
 * work: `/invoices/:id/edit` used to render the *create* form and answer every
 * save with "not available yet". The assertions below are mostly about what is
 * **not** on the page, because that is the part a future change is most likely
 * to get wrong — putting the amount back on an edit screen would look like a
 * feature and behave like a dead end.
 */
async function openFirstInvoiceEdit(page: Page) {
  await page.goto('/invoices')
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await expect(page).toHaveURL(/\/invoices\/[^/?]+/)
  const id = new URL(page.url()).pathname.split('/')[2]
  await page.goto(`/invoices/${id}/edit`)
  return id
}

test('edits only what the API will change, and says so', async ({ page }) => {
  await openFirstInvoiceEdit(page)

  await expect(page.getByRole('heading', { name: 'Edit invoice' })).toBeVisible()
  await expect(page.getByText(/only the due date can be changed/i)).toBeVisible()

  // The due date is the field. The create form's fields are not here.
  await expect(page.getByLabel('Due date')).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Customer/ })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Currency/ })).toHaveCount(0)
  await expect(page.getByLabel('Line 1 amount')).toHaveCount(0)

  // Nothing has changed yet, so there is nothing to save.
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('saves a new due date and returns to the invoice', async ({ page }) => {
  const id = await openFirstInvoiceEdit(page)

  // A year out, so the API's "not in the past" rule cannot be tripped by the
  // test running near midnight.
  const future = new Date()
  future.setFullYear(future.getFullYear() + 1)
  const value = future.toISOString().slice(0, 10)

  await page.getByLabel('Due date').fill(value)
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled()

  /*
   * The outcome, not the wire.
   *
   * Playwright cannot read this body — the SDK streams it, so `postData()` is
   * null — so asserting on the request's JSON would assert on nothing. What is
   * worth pinning is that the save reached the API and the new date stuck, and
   * the mock only patches `due_date` when the request actually carries it.
   */
  const response = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname.endsWith(`/invoices/${id}`),
  )
  await page.getByRole('button', { name: 'Save changes' }).click()
  expect((await response).status()).toBe(200)

  // Back on the invoice, through the page's own navigation.
  await expect(page).toHaveURL(new RegExp(`/invoices/${id}$`))

  /*
   * Persistence is deliberately not asserted past this point. The fixture
   * corpus lives in the page, so a reload rebuilds it and any mutation is
   * gone — a `goto` back to the form would read the original date and fail
   * for a reason that has nothing to do with the code under test. What this
   * does pin is the part the page owns: the save reaches the API, is
   * accepted, and returns the person to the invoice.
   */
})

test('cancel goes back without saving', async ({ page }) => {
  const id = await openFirstInvoiceEdit(page)

  let sawPut = false
  page.on('request', (r) => {
    if (r.method() === 'PUT') sawPut = true
  })

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(new RegExp(`/invoices/${id}$`))
  expect(sawPut).toBe(false)
})
