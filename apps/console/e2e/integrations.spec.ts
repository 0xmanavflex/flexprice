import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ShellPage } from './pages/shell'

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

const SANDBOX_ENVIRONMENT = 'env_01KVSNYVPMAP6JJGDF177V2DE6'

/** Billing entities on in the sandbox: US (default), EU and UK unless others are given. */
async function enableEntities(
  page: Page,
  entities: [id: string, name: string, prefix: string][] = [
    ['be_us', 'Northwind US', 'US'],
    ['be_eu', 'Northwind EU', 'EU'],
    ['be_uk', 'Northwind UK', 'UK'],
  ],
) {
  await page.addInitScript(
    ({ environmentId, entities }) => {
      if (window.sessionStorage.getItem('flexprice.mock.billingEntities')) return
      window.sessionStorage.setItem(
        'flexprice.mock.billingEntities',
        JSON.stringify({
          seq: entities.length,
          environments: [
            [
              environmentId,
              {
                mode: 'enabled',
                readsSinceEnable: 2,
                rows: entities.map(([id, name, prefix], index) => ({
                  id,
                  name,
                  legal_name: name,
                  is_default: index === 0,
                  invoice_number_prefix: prefix,
                  seller_details: { address: {} },
                  tax_identifiers: [],
                  status: 'published',
                  created_at: '2026-10-01T00:00:00Z',
                })),
              },
            ],
          ],
        }),
      )
    },
    { environmentId: SANDBOX_ENVIRONMENT, entities },
  )
}

const CONNECTION_URL = /\/webhooks\/stripe\/[^/]+\/[^/]+\/(conn_[0-9A-HJKMNP-TV-Z]{26})$/

/** From the Stripe page, connects Stripe for Northwind UK with its webhook secret in one submit. */
async function connectStripeForUk(page: Page) {
  await page.goto('/integrations/stripe')
  await page
    .getByRole('row')
    .filter({ hasText: 'Northwind UK' })
    .getByRole('button', { name: 'Actions for Northwind UK' })
    .click()
  await page.getByRole('menuitem', { name: 'Connect' }).click()
  const sheet = page.getByRole('dialog', { name: /Connect Stripe/ })
  await expect(sheet.getByRole('combobox', { name: /Billing entity/ })).toHaveText(/Northwind UK/)
  await sheet.getByLabel('Connection name').fill('Stripe UK')
  await sheet.getByRole('textbox', { name: /^Secret key/ }).fill('sk_test_uk')
  await sheet.getByLabel('Publishable key').fill('pk_test_uk')
  await sheet.getByRole('button', { name: 'Continue' }).click()
  await sheet.getByRole('button', { name: 'Continue' }).click()
  // The address names the connection before it exists.
  const address = (await sheet.getByText(CONNECTION_URL).textContent()) ?? ''
  const id = CONNECTION_URL.exec(address)?.[1]
  await sheet.getByRole('textbox', { name: /^Webhook signing secret/ }).fill('whsec_uk')
  const create = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/connections'),
  )
  await sheet.getByRole('button', { name: 'Connect Stripe' }).click()
  const body = (await create).postDataJSON() as Record<string, unknown>
  expect(body).toMatchObject({
    id,
    billing_entity_id: 'be_uk',
    encrypted_secret_data: { webhook_secret: 'whsec_uk' },
  })
  await expect(sheet).toBeHidden()
  return { address, id }
}

test.describe('integrations', () => {
  test('shows the catalogue with connection status', async ({ page }) => {
    await page.goto('/integrations')

    await expect(page.getByRole('heading', { name: 'Available', level: 2 })).toBeVisible()
    await expect(page.getByTestId('integration-stripe')).toContainText('Connected')
    await expect(page.getByTestId('integration-razorpay')).toContainText('Not connected')
  })

  test('links a provider to its setup guide', async ({ page }) => {
    await page.goto('/integrations')

    const guide = page.getByRole('link', { name: /Setup guide for Stripe/ })
    await expect(guide).toHaveAttribute('href', 'https://docs.flexprice.io/integrations/stripe/connection-setup')
    await expect(guide).toHaveAttribute('target', '_blank')
  })

  test('connects a provider, keeps the key hidden, and shows it connected', async ({ page }) => {
    await page.goto('/integrations')
    await page.getByRole('button', { name: 'Connect Razorpay' }).click()

    const sheet = page.getByRole('dialog', { name: /Connect Razorpay/ })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Continue' }).click()
    // Required keys are checked before anything is sent.
    await expect(sheet.getByText(/required/i).first()).toBeVisible()

    await sheet.getByLabel('Connection name').fill('Razorpay live')
    await sheet.getByLabel('Key ID').fill('rzp_test_abc123')
    const secret = sheet.getByRole('textbox', { name: /^Key secret/ })
    await secret.fill('super-secret')
    await expect(secret).toHaveAttribute('type', 'password')
    await sheet.getByRole('button', { name: 'Show Key secret' }).click()
    await expect(secret).toHaveAttribute('type', 'text')

    // Credentials, then sync, then the webhook address.
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await expect(sheet.getByText('Push invoices')).toBeVisible()
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await expect(sheet.getByText('Webhook URL', { exact: true })).toBeVisible()
    // Razorpay signs every webhook, so its secret is required, as in V1.
    await sheet.getByRole('button', { name: 'Connect Razorpay' }).click()
    await expect(sheet.getByText('Webhook signing secret is required.')).toBeVisible()
    await sheet.getByRole('textbox', { name: /Webhook signing secret/ }).fill('whsec_test')
    await sheet.getByRole('button', { name: 'Connect Razorpay' }).click()

    await expect(page.getByTestId('integration-razorpay')).toContainText('Connected')
  })

  test('manages a connection and disconnects it after confirming', async ({ page }) => {
    await page.goto('/integrations')
    await page.getByRole('button', { name: 'Configure Stripe' }).click()

    const sheet = page.getByRole('dialog', { name: /Stripe/ })
    await expect(sheet.getByText('Keys are stored encrypted and cannot be shown.')).toBeVisible()
    await sheet.getByLabel('Connection name').fill('Stripe (prod)')
    await sheet.getByRole('button', { name: 'Save changes' }).click()

    await sheet.getByRole('button', { name: 'Disconnect Stripe' }).click()
    const confirm = page.getByRole('dialog', { name: 'Disconnect Stripe?' })
    await expect(confirm).toContainText('this connection is archived')
    await confirm.getByRole('button', { name: 'Disconnect' }).click()

    await expect(page.getByTestId('integration-stripe')).toContainText('Not connected')
  })

  test('lists connections per billing entity and manages them from the provider page', async ({
    page,
  }) => {
    await enableEntities(page)

    const shell = new ShellPage(page)
    await shell.goto('/')
    await expect(shell.home).toBeVisible()
    const created = await page.evaluate(async (environmentId) => {
      const response = await fetch('/v1/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Environment-ID': environmentId },
        body: JSON.stringify({
          name: 'Stripe EU',
          provider_type: 'stripe',
          billing_entity_id: 'be_eu',
          encrypted_secret_data: {},
        }),
      })
      return response.status
    }, SANDBOX_ENVIRONMENT)
    expect(created).toBe(201)
    // Client-side, so the mock keeps the connection.
    await shell.go('Integrations')

    const card = page.getByTestId('integration-stripe')
    await expect(card).not.toContainText('Stripe EU')
    await expect(card).not.toContainText('Northwind')

    await card.getByRole('button', { name: 'Manage Stripe' }).click()
    await expect(page).toHaveURL(/\/integrations\/stripe$/)
    await expect(page.getByRole('row')).toHaveCount(4)
    const uk = page.getByRole('row').filter({ hasText: 'Northwind UK' })
    await uk.getByRole('button', { name: 'Actions for Northwind UK' }).click()
    await expect(page.getByRole('menuitem', { name: 'Connect' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page
      .getByRole('row')
      .filter({ hasText: 'Stripe EU' })
      .getByRole('button', { name: /^Actions for / })
      .click()
    await page.getByRole('menuitem', { name: 'Configure' }).click()
    const sheet = page.getByRole('dialog', { name: /Stripe/ })
    await expect(sheet.getByLabel('Connection name')).toHaveValue('Stripe EU')
  })

  test('connects Stripe for an entity with its own webhook in one step', async ({ page }) => {
    await enableEntities(page)
    const puts: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'PUT') puts.push(request.url())
    })
    const { address } = await connectStripeForUk(page)
    expect(puts).toEqual([])
    await expect(page.getByRole('row').filter({ hasText: 'Northwind UK' })).toContainText(
      'Stripe UK',
    )

    await page
      .getByRole('row')
      .filter({ hasText: 'Stripe UK' })
      .getByRole('button', { name: 'Actions for Northwind UK' })
      .click()
    await page.getByRole('menuitem', { name: 'Configure' }).click()
    const manage = page.getByRole('dialog', { name: /Stripe/ })
    await expect(manage.getByText(address, { exact: true })).toBeVisible()
  })

  test('keeps the same connection id when a failed connect is retried', async ({ page }) => {
    await enableEntities(page)
    // Mock mode answers from a service worker, which `page.route` does not see.
    await page.addInitScript(() => {
      const ids: unknown[] = []
      Object.assign(window, { __connectIds: ids })
      const realFetch = window.fetch.bind(window)
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (init?.method === 'POST' && /\/connections$/.test(url)) {
          ids.push((JSON.parse(String(init.body)) as Record<string, unknown>)['id'])
          if (ids.length === 1) {
            return new Response(JSON.stringify({ message: 'Something went wrong' }), {
              status: 500,
              headers: { 'content-type': 'application/json' },
            })
          }
        }
        return realFetch(input, init)
      }
    })
    await page.goto('/integrations')
    await page.getByRole('button', { name: 'Connect Razorpay' }).click()
    const sheet = page.getByRole('dialog', { name: /Connect Razorpay/ })
    await sheet.getByLabel('Connection name').fill('Razorpay')
    await sheet.getByLabel('Key ID').fill('rzp_test_abc')
    await sheet.getByRole('textbox', { name: /^Key secret/ }).fill('shh')
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await sheet.getByRole('textbox', { name: /Webhook signing secret/ }).fill('whsec_test')
    await sheet.getByRole('button', { name: 'Connect Razorpay' }).click()
    await expect(sheet.getByRole('alert')).toBeVisible()
    await sheet.getByRole('button', { name: 'Connect Razorpay' }).click()
    await expect(sheet).toBeHidden()
    const ids = await page.evaluate(
      () => (window as unknown as { __connectIds: unknown[] }).__connectIds,
    )
    expect(ids).toHaveLength(2)
    expect(ids[0]).toMatch(/^conn_[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(ids[1]).toBe(ids[0])
  })

  test('connects Razorpay for a billing entity', async ({ page }) => {
    await enableEntities(page)
    await page.goto('/integrations/razorpay')
    const row = page.getByRole('row').filter({ hasText: 'Northwind UK' })
    await row.getByRole('button', { name: 'Actions for Northwind UK' }).click()
    await page.getByRole('menuitem', { name: 'Connect' }).click()
    const sheet = page.getByRole('dialog', { name: /Connect Razorpay/ })
    await sheet.getByLabel('Connection name').fill('Razorpay UK')
    await sheet.getByLabel('Key ID').fill('rzp_test_uk')
    await sheet.getByRole('textbox', { name: /^Key secret/ }).fill('shh')
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await sheet.getByRole('button', { name: 'Continue' }).click()
    // Razorpay signs every webhook, so its secret is required, as in V1.
    await sheet.getByRole('textbox', { name: /Webhook signing secret/ }).fill('whsec_test')
    await sheet.getByRole('button', { name: 'Connect Razorpay' }).click()
    await expect(sheet).toBeHidden()
    await expect(row).toContainText('Razorpay UK')
  })

  test('starts QuickBooks consent for a billing entity', async ({ page }) => {
    await enableEntities(page)
    await page.goto('/integrations')
    await page.getByRole('button', { name: 'Connect QuickBooks' }).click()
    const sheet = page.getByRole('dialog', { name: /Connect QuickBooks/ })
    await sheet.getByRole('textbox', { name: /^Client ID/ }).fill('qb_client')
    await sheet.getByRole('textbox', { name: /^Client secret/ }).fill('qb_secret')
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await sheet.getByRole('button', { name: 'Continue' }).click()
    const address =
      (await sheet
        .getByText(/\/webhooks\/quickbooks\/[^/]+\/[^/]+\/conn_[0-9A-Z]{26}$/)
        .textContent()) ?? ''
    await sheet.getByRole('textbox', { name: /^Webhook verifier token/ }).fill('qb_verifier')
    const init = page.waitForRequest((request) => request.url().endsWith('/oauth/init'))
    await sheet.getByRole('button', { name: 'Continue to QuickBooks' }).click()
    expect((await init).postDataJSON()).toMatchObject({
      id: address.split('/').pop(),
      provider: 'quickbooks',
      billing_entity_id: 'be_us',
      credentials: { webhook_verifier_token: 'qb_verifier' },
    })
  })

  test("an entity's integrations tab lists its connections and connects one for it", async ({
    page,
  }) => {
    await enableEntities(page)
    await page.goto('/settings/billing-entities/be_uk?tab=integrations')

    const payments = page.getByRole('region', { name: 'Payments' })
    // The environment's Stripe belongs to the default entity, not to Northwind UK.
    await expect(payments.getByRole('row', { name: /Stripe/ })).toContainText('—')
    await payments.getByRole('button', { name: 'Actions for Stripe' }).click()
    await page.getByRole('menuitem', { name: 'Connect' }).click()
    const sheet = page.getByRole('dialog', { name: /Connect Stripe/ })
    await expect(sheet.getByRole('combobox', { name: /Billing entity/ })).toHaveText(/Northwind UK/)
  })
})
