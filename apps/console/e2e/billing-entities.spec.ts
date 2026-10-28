import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ShellPage } from './pages/shell'

const WRITER = 'user_01M38QUSER0000000000002' // all_writer, not a super admin

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

const SECTION = '/settings?section=billing-entities&tab=entities'

test('billing entities: a super admin enables them and the list appears without a reload', async ({
  page,
}) => {
  await page.goto(SECTION)
  const enable = page.getByRole('button', { name: 'Enable billing entities' })
  await expect(enable).toBeEnabled()
  await enable.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Enable billing entities in Sandbox?')).toBeVisible()
  await expect(dialog.getByText(/can't be turned off/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Enable billing entities' }).click()

  await expect(page.getByText('Enabling billing entities in Sandbox…')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Default' })).toBeVisible()
})

test('billing entities: the backend refusal is shown and the card still offers Enable', async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem('flexprice.mock.taxEngine', 'stripe'))
  await page.goto(SECTION)
  await page.getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable billing entities' }).click()

  await expect(page.getByText(/cannot be used while this environment calculates tax/)).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Enable billing entities' })).toBeEnabled()
})

test('billing entities: someone who is not a super admin cannot enable them', async ({
  page,
  context,
}) => {
  await context.addInitScript(
    (id) => window.localStorage.setItem('flexprice.mock.userId', id),
    WRITER,
  )
  await page.goto(SECTION)
  await expect(page.getByRole('button', { name: 'Enable billing entities' })).toBeDisabled()
  await expect(page.getByText('Only super admins can enable billing entities.')).toBeVisible()
})

test('billing entities: reloading while enabling still shows enabling, then the list', async ({
  page,
}) => {
  await page.goto(SECTION)
  await page.getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable billing entities' }).click()
  await expect(page.getByText('Enabling billing entities in Sandbox…')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('cell', { name: 'Default' })).toBeVisible()
})

test('billing entities: create an entity, a taken prefix is refused, then edit it on its page', async ({
  page,
}) => {
  await page.goto(SECTION)
  await page.getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable billing entities' }).click()
  await expect(page.getByRole('cell', { name: 'Default' })).toBeVisible()

  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('textbox', { name: /^name/i }).fill('Acme India')
  await page.getByRole('textbox', { name: /legal name/i }).fill('Acme India Pvt Ltd')
  const prefix = page.getByRole('textbox', { name: /invoice prefix/i })
  await prefix.fill('NWS')
  await page.getByRole('button', { name: 'Create billing entity' }).click()
  await expect(page.getByText('Invoice prefix already in use').first()).toBeVisible()

  await prefix.fill('NWIN')
  await expect(page.getByTestId('invoice-number-example')).toContainText(/^NWIN-/)
  await page.getByRole('button', { name: 'Create billing entity' }).click()

  await expect(page.getByRole('heading', { name: 'Acme India' })).toBeVisible()
  await expect(page.getByTestId('invoice-number-example')).toContainText(/^NWIN-/)
  await page.getByRole('textbox', { name: /invoice prefix/i }).fill('NWIN2')
  await expect(page.getByTestId('invoice-number-example')).toContainText(/^NWIN2-/)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Billing entity saved')).toBeVisible()
})

test('billing entities: a stale link to an entity page returns to the section while entities are off', async ({
  page,
}) => {
  await page.goto('/settings/billing-entities/new')
  await expect(page).toHaveURL(/section=billing-entities/)
  await expect(page.getByRole('button', { name: 'Enable billing entities' })).toBeVisible()
})

test('billing entities: add a default tax on an entity, it posts as an auto-applied entity tax', async ({
  page,
}) => {
  await page.goto(SECTION)
  await page.getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('row').nth(1).getByRole('cell').first().click()

  await page.getByRole('tab', { name: 'Taxes' }).click()
  await expect(
    page.getByText(
      'Added automatically to new customers of this entity. Existing customers keep their taxes.',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add tax rate' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Tax rate' }).click()
  await page.getByRole('option', { name: /Canada GST/ }).click()

  const created = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/taxes/associations'),
  )
  await dialog.getByRole('button', { name: 'Add tax rate' }).click()
  expect(await (await created).json()).toMatchObject({
    entity_type: 'billing_entity',
    auto_apply: true,
  })
  await expect(page.getByRole('cell', { name: /Canada GST/ })).toBeVisible()
})

test('billing entities: a taxes or integrations link falls back to the details tab', async ({
  page,
}) => {
  await page.goto(SECTION)
  await page.getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await page.waitForURL(/billing-entities\/[^/?]+/)
  const base = page.url().split('?')[0]
  await page.goto(`${base}?tab=integrations`)
  await expect(page.getByRole('textbox', { name: /^name/i })).toBeVisible()
})

async function enableEntities(page: Page) {
  await page.goto(SECTION)
  await page.getByRole('button', { name: 'Enable billing entities' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable billing entities' }).click()
  await expect(page.getByRole('cell', { name: 'Default' })).toBeVisible()
}

test('billing entities: invoicing prefix is editable while entities are off', async ({ page }) => {
  await page.goto('/settings?section=invoicing&tab=invoices')
  const prefix = page.getByRole('textbox', { name: /^prefix/i })
  await expect(prefix).toBeEditable()
  await expect(page.getByRole('link', { name: 'Manage billing entities' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reset to defaults' })).toBeVisible()
})

test('billing entities: invoicing prefix is read-only and points to the entities once enabled', async ({
  page,
}) => {
  await enableEntities(page)
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await page.getByRole('textbox', { name: /invoice prefix/i }).fill('ZZ')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Billing entity saved')).toBeVisible()
  await page.goto('/settings?section=invoicing&tab=invoices')
  const prefix = page.getByRole('textbox', { name: /^prefix/i })
  await expect(prefix).toHaveValue('Set on each billing entity')
  await expect(prefix).not.toBeEditable()
  await expect(page.getByText(/^ZZ-\d{6}-/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset to defaults' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Manage billing entities' }).click()
  await expect(page).toHaveURL(/section=billing-entities/)
  await expect(page.getByRole('cell', { name: 'Default' })).toBeVisible()
})

test('billing entities: organization profile is editable while entities are off', async ({
  page,
}) => {
  await page.goto('/settings?section=organization&tab=profile')
  await expect(page.getByRole('textbox', { name: /billing email/i })).toBeEditable()
  await expect(page.getByRole('link', { name: 'Manage default entity' })).toHaveCount(0)
})

test('billing entities: organization profile seller details are read-only and link to the default entity once enabled', async ({
  page,
}) => {
  await enableEntities(page)
  await page.goto('/settings?section=organization&tab=profile')
  await expect(page.getByText('Seller details now live on billing entities.')).toBeVisible()
  await expect(page.getByRole('textbox', { name: /billing email/i })).not.toBeEditable()
  await expect(page.getByRole('textbox', { name: /^phone/i })).not.toBeEditable()
  await expect(page.getByRole('textbox', { name: /address line 1/i })).not.toBeEditable()
  await expect(page.getByRole('textbox', { name: /^name/i })).toBeEditable()
  await page.getByRole('link', { name: 'Manage default entity' }).click()
  await expect(page).toHaveURL(/\/settings\/billing-entities\/[^/?]+/)
})

async function addIndiaEntity(page: Page) {
  await enableEntities(page)
  await page.getByRole('button', { name: 'New entity' }).click()
  await page.getByRole('textbox', { name: /^name/i }).fill('Northwind India')
  await page.getByRole('textbox', { name: /legal name/i }).fill('Northwind India Pvt Ltd')
  await page.getByRole('textbox', { name: /invoice prefix/i }).fill('NWIN')
  await page.getByRole('button', { name: 'Create billing entity' }).click()
  await expect(page.getByRole('heading', { name: 'Northwind India' })).toBeVisible()
}

const searchBody = (page: Page) =>
  page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/customers/search'),
  )

test('billing entities: customers show their entity, filter by it, and pick one at create', async ({
  page,
}) => {
  await addIndiaEntity(page)

  await page.goto('/customers/new')
  const picker = page.getByRole('combobox', { name: /billing entity/i })
  await expect(picker).toHaveText(/Northwind Systems/)
  await picker.click()
  await page.getByRole('option', { name: 'Northwind India' }).click()
  await page.getByRole('textbox', { name: /^name/i }).fill('Bharat Freight')
  const created = page.waitForRequest(
    (request) => request.method() === 'POST' && /\/customers$/.test(request.url()),
  )
  await page.getByRole('button', { name: 'Create customer' }).click()
  const entityId = (await created).postDataJSON().billing_entity_id as string
  expect(entityId).toBeTruthy()
  await expect(page.getByRole('button', { name: 'Northwind India' })).toBeVisible()

  // In-app, so the mock keeps the customer just created.
  await page.getByRole('button', { name: 'Customers' }).first().click()
  await expect(page.getByRole('columnheader', { name: 'Billing entity' })).toBeVisible()
  // Customers created before entities carry none: they read as the default entity.
  await expect(page.getByRole('cell', { name: 'Northwind Systems' }).first()).toBeVisible()

  await page.getByRole('button', { name: /^Filter/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Advanced filter' })
  await dialog.getByRole('button', { name: 'Add filter' }).click()
  await page.getByRole('option', { name: 'Billing entity', exact: true }).click()
  await page.getByRole('option', { name: 'is', exact: true }).click()
  const asked = searchBody(page)
  await page.getByRole('option', { name: 'Northwind India' }).click()
  const body = (await asked).postDataJSON()
  expect(body.billing_entity_id).toBe(entityId)
  expect(JSON.stringify(body.filters ?? [])).not.toContain('billing_entity_id')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('cell', { name: 'Bharat Freight' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Northwind Systems' })).toHaveCount(0)
})

test('billing entities: customers have no entity column, filter or picker while entities are off', async ({
  page,
}) => {
  await page.goto('/customers')
  await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Billing entity' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Filter/ }).click()
  await page
    .getByRole('dialog', { name: 'Advanced filter' })
    .getByRole('button', { name: 'Add filter' })
    .click()
  await expect(page.getByRole('option', { name: 'Email', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Billing entity', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.goto('/customers/new')
  await expect(page.getByRole('textbox', { name: /^name/i })).toBeVisible()
  await expect(page.getByRole('combobox', { name: /billing entity/i })).toHaveCount(0)
})

test('billing entities: switching to an environment without entities drops the customer entity column and a stale entity filter', async ({
  page,
}) => {
  await enableEntities(page)
  await page.goto('/customers')
  await expect(page.getByRole('columnheader', { name: 'Billing entity' })).toBeVisible()

  const shell = new ShellPage(page)
  await shell.switchEnvironment('Production')
  await expect(page.getByRole('columnheader', { name: 'Billing entity' })).toHaveCount(0)

  const stale = encodeURIComponent(
    JSON.stringify([{ field: 'billing_entity_id', op: 'eq', value: 'be_mock_1' }]),
  )
  const asked = searchBody(page)
  await page.goto(`/customers?filters=${stale}`)
  expect((await asked).postDataJSON()).not.toHaveProperty('billing_entity_id')
  await expect(page.getByRole('row').nth(1)).toBeVisible()
})
