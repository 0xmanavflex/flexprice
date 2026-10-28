import { expect, test } from './fixtures'

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
