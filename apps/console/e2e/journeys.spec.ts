import { expect, test, type Page } from '@playwright/test'

/**
 * Customer journeys: the flows a billing team runs end to end, each crossing
 * more than one surface.
 *
 * The other specs prove a surface works on its own. These prove the surfaces
 * hand off to each other — the customer you just made is the one the contract
 * bills, the invoice you just finalized is the one the payment settles. Each
 * carries the `@journey` tag, which the CI summary posted to Slack lists by
 * name (`.github/workflows/e2e.yml`); `--grep @journey` runs only these.
 *
 * Every step after the first is an in-app navigation, never a `goto`: the mock
 * store lives in the page, so a reload would forget the records the journey
 * just created.
 */

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

/** Creates a customer from the list and lands on its detail page. */
async function createCustomer(page: Page, name: string) {
  await page.goto('/customers')
  await page.getByRole('button', { name: 'New customer' }).first().click()
  await expect(page).toHaveURL(/\/customers\/new/)
  await page.getByLabel('Name', { exact: false }).first().fill(name)
  await page.getByLabel('Email').fill(`${name.toLowerCase().replace(/\W+/g, '.')}@example.com`)
  const created = page.waitForRequest(isWrite('POST', /\/v1\/customers$/))
  await page.getByRole('button', { name: 'Create customer' }).click()
  await created
  await expect(page).toHaveURL(/\/customers\/(?!new\b)[^/?]+(?:\?|$)/)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test.describe('customer journeys', { tag: '@journey' }, () => {
  test('a new customer is put on a contract, and its first invoice appears', async ({ page }) => {
    await createCustomer(page, 'Journey Contracts Ltd')

    // No live contract yet, so sample events stay in the menu but cannot run.
    await page.getByRole('button', { name: 'Customer actions' }).click()
    const unavailable = page.getByRole('menuitem', { name: /Stream sample events/ })
    await expect(unavailable).toBeDisabled()
    await expect(unavailable).toContainText('Needs an active or trialing contract.')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Customer actions' }).click()
    await page.getByRole('menuitem', { name: 'Create contract' }).click()
    await expect(page).toHaveURL(/\/customers\/[^/]+\/contracts\/new/)

    await page.getByRole('combobox', { name: /^Plan/ }).click()
    await page.getByRole('option').first().click()
    const currency = page.getByRole('combobox', { name: /Currency/ })
    if ((await currency.textContent())?.includes('Choose')) {
      await currency.click()
      await page.getByRole('option').first().click()
    }
    while (await page.getByRole('button', { name: 'Next' }).isVisible()) {
      await page.getByRole('button', { name: 'Next' }).click()
    }
    const contract = page.waitForRequest(isWrite('POST', /\/v1\/subscriptions$/))
    await page.getByRole('button', { name: 'Create contract' }).click()
    await contract

    // Back on the customer, which now has a contract and the invoice it issued.
    await expect(page).toHaveURL(/\/customers\/(?!new\b)[^/?]+(?:\?|$)/)

    // The new contract is live, so the same menu item can stream sample events.
    await page.getByRole('button', { name: 'Customer actions' }).click()
    const stream = page.waitForRequest(isWrite('POST', /\/portal\/onboarding\/events$/))
    await page.getByRole('menuitem', { name: 'Stream sample events' }).click()
    await stream
    await expect(page.getByText('Streaming sample events')).toBeVisible()

    await page.getByRole('tab', { name: 'Invoices' }).click()
    const invoices = page.getByRole('region', { name: /Invoices table/ })
    await expect(invoices.getByRole('row').nth(1)).toBeVisible()
    await invoices.getByRole('row').nth(1).getByRole('cell').first().click()
    await expect(page).toHaveURL(/\/invoices\/(?!new\b)[^/?]+(?:\?|$)/)
    await expect(page.getByRole('heading', { name: 'Invoice', level: 1 })).toBeVisible()
  })

  test('an invoice is finalized, then a payment recorded against it settles it', async ({
    page,
  }) => {
    await page.goto('/invoices/new')
    await page.getByRole('combobox', { name: /Customer/ }).click()
    await page.getByRole('option').first().click()
    await page.getByRole('combobox', { name: /Currency/ }).click()
    await page.getByRole('option', { name: 'USD' }).click()
    await page.getByLabel('Line 1 name').fill('Onboarding')
    await page.getByLabel('Unit price for line 1').fill('240.00')
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page).toHaveURL(/\/invoices\/(?!new\b)[^/?]+(?:\?|$)/)
    const invoiceUrl = page.url()

    const menu = page.getByRole('menu', { name: 'More actions' })
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Finalize invoice' }).click()
    await expect(page.getByText('Finalized', { exact: true }).first()).toBeVisible()
    await expect(menu).toBeHidden()

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Record payment' }).click()
    await expect(page).toHaveURL(/\/payments\/new\?invoice=[^&]+/)

    const currency = page.getByRole('combobox', { name: /Currency/ })
    if ((await currency.textContent())?.includes('Choose')) {
      await currency.click()
      await page.getByRole('option', { name: 'USD' }).click()
    }
    await page.getByLabel('Amount').fill('240.00')
    // "Process now" is on by default: the payment succeeds as it is recorded.
    await expect(page.getByRole('switch', { name: /Process now/ })).toBeChecked()
    await page.getByRole('button', { name: 'Create payment' }).click()
    await expect(page).toHaveURL(/\/payments\/(?!new\b)[^/?]+(?:\?|$)/)
    await expect(page.getByText('Succeeded').first()).toBeVisible()

    // The invoice it settled shows the payment and no balance left to pay.
    // Back through history, an in-app navigation, so the mock store keeps both.
    await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(invoiceUrl)
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible()
  })

  test("a new customer's wallet is created and topped up", async ({ page }) => {
    await createCustomer(page, 'Journey Wallets Ltd')

    await page.getByRole('tab', { name: 'Wallet' }).click()
    await expect(page.getByText('No wallet yet')).toBeVisible()
    await page.getByRole('button', { name: 'Create wallet' }).click()
    const create = page.getByRole('dialog', { name: 'Create wallet' })
    await create.getByLabel('Conversion rate').fill('1')
    await create.getByLabel('Initial credits', { exact: true }).fill('500')
    await create.getByRole('button', { name: 'Create wallet' }).click()
    await expect(page.getByText('500 credits').first()).toBeVisible()

    await page.getByRole('button', { name: 'Top up wallet' }).click()
    const topUp = page.getByRole('dialog', { name: 'Top up wallet' })
    await topUp.getByLabel('Credits').fill('125')
    await topUp.getByRole('button', { name: 'Top up' }).click()
    await expect(topUp).toBeHidden()
    await expect(page.getByText('625 credits').first()).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Transactions table' }).getByText('Purchased credits'),
    ).toBeVisible()
  })

  test('a plan is created with a charge, and its detail lists the charge', async ({ page }) => {
    await page.goto('/plans')
    await page.getByRole('button', { name: 'New plan' }).first().click()
    await expect(page).toHaveURL(/\/plans\/new/)

    await page.getByLabel(/^Name/).fill('Journey Scale')
    await page.getByRole('button', { name: /^Next/ }).click()
    await expect(page).toHaveURL(/step=charges/)

    await page.getByRole('button', { name: 'Add charge' }).first().click()
    await page.getByLabel('Amount').fill('49.00')
    await page.getByRole('button', { name: 'Add charge' }).last().click()
    await expect(page.getByRole('button', { name: /^Remove / })).toBeVisible()

    while (await page.getByRole('button', { name: /^Next/ }).isVisible()) {
      await page.getByRole('button', { name: /^Next/ }).click()
    }
    const plan = page.waitForRequest(isWrite('POST', /\/v1\/plans$/))
    await page.getByRole('button', { name: /^Create plan/ }).click()
    await plan

    await expect(page).toHaveURL(/\/plans\/(?!new)[^/?]+/)
    await expect(page.getByRole('heading', { level: 1, name: 'Journey Scale' })).toBeVisible()
    const charges = page.getByRole('region', { name: 'Charges table' })
    await expect(charges.getByText('$49.00').first()).toBeVisible()
  })
})
