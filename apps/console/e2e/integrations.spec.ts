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

/** Connections the mock adds to its own, kept across reloads. */
async function seedConnections(
  page: Page,
  rows: [id: string, name: string, provider: string, entity: string][],
) {
  await page.addInitScript((rows) => {
    window.sessionStorage.setItem(
      'flexprice.mock.connections',
      JSON.stringify(
        rows.map(([id, name, provider, entity]) => ({
          id,
          name,
          provider_type: provider,
          connection_status: 'published',
          billing_entity_id: entity,
          metadata: {},
          sync_config: {},
          created_at: '2026-10-01T00:00:00Z',
        })),
      ),
    )
  }, rows)
}

/** From the Stripe page, creates Stripe for Northwind UK and returns the sheet on its webhook step. */
async function connectStripeForUk(page: Page) {
  await page.goto('/integrations/stripe')
  await page
    .getByRole('row')
    .filter({ hasText: 'Northwind UK' })
    .getByRole('button', { name: 'Connect Northwind UK' })
    .click()
  const sheet = page.getByRole('dialog', { name: /Connect Stripe/ })
  await expect(sheet.getByRole('combobox', { name: /Billing entity/ })).toHaveText(/Northwind UK/)
  await sheet.getByLabel('Connection name').fill('Stripe UK')
  await sheet.getByRole('textbox', { name: /^Secret key/ }).fill('sk_test_uk')
  await sheet.getByLabel('Publishable key').fill('pk_test_uk')
  await sheet.getByRole('button', { name: 'Continue' }).click()
  const create = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/connections'),
  )
  await sheet.getByRole('button', { name: 'Connect Stripe' }).click()
  const body = (await create).postDataJSON() as Record<string, unknown>
  expect(body['billing_entity_id']).toBe('be_uk')
  expect(body['encrypted_secret_data']).not.toHaveProperty('webhook_secret')
  return sheet
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
    await expect(guide).toHaveAttribute('href', 'https://docs.flexprice.io/integrations/stripe/')
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
    const secret = sheet.locator('input[data-slot="input-group-control"]')
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
    await expect(uk.getByRole('button', { name: 'Connect Northwind UK' })).toBeVisible()

    await page
      .getByRole('row')
      .filter({ hasText: 'Stripe EU' })
      .getByRole('button', { name: 'Configure Stripe EU' })
      .click()
    const sheet = page.getByRole('dialog', { name: /Stripe/ })
    await expect(sheet.getByLabel('Connection name')).toHaveValue('Stripe EU')
  })

  test('connects Stripe for an entity, then saves its own webhook secret', async ({ page }) => {
    await enableEntities(page)
    const sheet = await connectStripeForUk(page)

    const url = sheet.getByText(/\/webhooks\/stripe\/[^/]+\/[^/]+\/conn_mock_\d+$/)
    await expect(url).toBeVisible()
    await sheet.getByRole('textbox', { name: /^Webhook signing secret/ }).fill('whsec_uk')
    const save = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' && /\/connections\/conn_mock_\d+$/.test(request.url()),
    )
    await sheet.getByRole('button', { name: 'Save webhook' }).click()
    expect((await save).postDataJSON()).toEqual({
      encrypted_secret_data: { webhook_secret: 'whsec_uk' },
    })
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('row').filter({ hasText: 'Northwind UK' })).toContainText(
      'Stripe UK',
    )
  })

  test('leaves the webhook for later and finds it on Configure', async ({ page }) => {
    await enableEntities(page)
    const sheet = await connectStripeForUk(page)
    const address = await sheet
      .getByText(/\/webhooks\/stripe\/[^/]+\/[^/]+\/conn_mock_\d+$/)
      .textContent()
    await sheet.getByRole('button', { name: 'Do this later' }).click()
    await expect(sheet).toBeHidden()

    await page
      .getByRole('row')
      .filter({ hasText: 'Stripe UK' })
      .getByRole('button', { name: 'Configure Stripe UK' })
      .click()
    const manage = page.getByRole('dialog', { name: /Stripe/ })
    await expect(manage.getByText(address!, { exact: true })).toBeVisible()
    await expect(manage.getByRole('textbox', { name: /^Webhook signing secret/ })).toHaveValue('')
    await expect(manage.getByRole('combobox', { name: /Billing entity/ })).toHaveText(
      /Northwind UK/,
    )
  })

  test('starts QuickBooks consent for a billing entity', async ({ page }) => {
    await enableEntities(page)
    await page.goto('/integrations')
    await page.getByRole('button', { name: 'Connect QuickBooks' }).click()
    const sheet = page.getByRole('dialog', { name: /Connect QuickBooks/ })
    await sheet.getByRole('textbox', { name: /^Client ID/ }).fill('qb_client')
    await sheet.getByRole('textbox', { name: /^Client secret/ }).fill('qb_secret')
    await sheet.getByRole('button', { name: 'Continue' }).click()
    const init = page.waitForRequest((request) => request.url().endsWith('/oauth/init'))
    await sheet.getByRole('button', { name: 'Continue to QuickBooks' }).click()
    expect((await init).postDataJSON()).toMatchObject({
      provider: 'quickbooks',
      billing_entity_id: 'be_us',
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
    await payments.getByRole('button', { name: 'Connect Stripe' }).click()
    const sheet = page.getByRole('dialog', { name: /Connect Stripe/ })
    await expect(sheet.getByRole('combobox', { name: /Billing entity/ })).toHaveText(/Northwind UK/)
  })

  test("a customer's preferred payment gateway is one of their entity's payment connections", async ({
    page,
  }) => {
    await enableEntities(page, [
      ['be_in', 'Northwind India', 'IN'],
      ['be_us', 'Northwind US', 'US'],
    ])
    await seedConnections(page, [
      ['conn_rzp_in', 'Razorpay India', 'razorpay', 'be_in'],
      ['conn_qb_in', 'QuickBooks India', 'quickbooks', 'be_in'],
      ['conn_stripe_us', 'Stripe US', 'stripe', 'be_us'],
    ])
    await page.goto('/customers')
    await page.getByRole('row').nth(1).getByRole('cell').first().click()
    await page.getByRole('tab', { name: 'Information' }).click()

    const gateway = page.getByRole('combobox', { name: 'Preferred payment gateway' })
    await expect(gateway).toHaveText('Automatic')
    await gateway.click()
    // The customer bills from the default entity, Northwind India.
    await expect(page.getByRole('option')).toHaveText(['Automatic', 'Stripe', 'Razorpay India'])
    const saved = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().endsWith('/preferred-connection'),
    )
    await page.getByRole('option', { name: 'Razorpay India' }).click()
    expect((await saved).postDataJSON()).toEqual({ connection_id: 'conn_rzp_in' })
    await expect(gateway).toHaveText('Razorpay India')

    await page.reload()
    await expect(gateway).toHaveText('Razorpay India')

    const cleared = page.waitForRequest(
      (request) => request.method() === 'DELETE' && request.url().endsWith('/preferred-connection'),
    )
    await gateway.click()
    await page.getByRole('option', { name: 'Automatic' }).click()
    await cleared
    await expect(gateway).toHaveText('Automatic')
    await page.reload()
    await expect(gateway).toHaveText('Automatic')
  })
})
