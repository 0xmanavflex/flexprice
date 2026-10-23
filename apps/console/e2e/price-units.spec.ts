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

test.describe('price unit create', () => {
  test('creates a price unit on its own page', async ({ page }) => {
    await page.goto('/price-units')
    await page.getByRole('button', { name: 'New price unit' }).first().click()
    await expect(page).toHaveURL(/\/price-units\/new$/)
    await expect(page.getByRole('heading', { name: 'Price unit' })).toBeVisible()

    await page.getByRole('button', { name: 'Create price unit' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('Credits')
    await page.getByLabel('Code').fill('CRD')
    await page.getByLabel('Symbol').fill('C')
    await page.getByLabel('Base currency').click()
    await page.getByRole('option', { name: /^USD/ }).first().click()
    await page.getByLabel('Conversion rate').fill('0.5')

    const request = page.waitForRequest(
      (r) => r.method() === 'POST' && /\/v1\/prices\/units$/.test(new URL(r.url()).pathname),
    )
    await page.getByRole('button', { name: 'Create price unit' }).click()
    await request
    await expect(page).not.toHaveURL(/\/price-units\/new$/)
  })

  test('cancel returns to the list', async ({ page }) => {
    await page.goto('/price-units/new')
    await page.getByRole('button', { name: 'Close form' }).click()
    await expect(page).toHaveURL(/\/price-units$/)
  })
})

test.describe('price unit edit', () => {
  test('the General pencil edits the name in place', async ({ page }) => {
    await page.goto('/price-units')
    const list = new CatalogListPage(page, {
      heading: 'Price units',
      searchLabel: 'Search price units',
    })
    await expect(list.rows().first()).toBeVisible({ timeout: 45_000 })
    await list.rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: 'View price unit' }).click()
    await expect(page).toHaveURL(/\/price-units\/(?!new)[^/?]+$/)

    const url = page.url()
    await page.getByRole('tab', { name: /Information/ }).click()
    await page.getByRole('button', { name: 'Edit general' }).click()
    await expect(page).toHaveURL(url)
    await page.getByLabel('Name', { exact: true }).fill('Renamed in place')
    const request = page.waitForRequest(
      (r) => r.method() === 'PUT' && /\/v1\/prices\/units\/[^/]+$/.test(new URL(r.url()).pathname),
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await request
    await expect(page.getByLabel('Name', { exact: true })).toBeHidden()
  })
})

test.describe('environment copy', () => {
  test('promotes the sandbox plans and features to production from the switcher', async ({
    page,
  }) => {
    await page.goto('/customers')
    await page.getByRole('button', { name: /Change environment/ }).click()
    await page.getByRole('menuitem', { name: 'Copy environment…' }).click()

    const dialog = page.getByRole('dialog', { name: 'Copy environment' })
    await expect(dialog).toBeVisible()
    // From a sandbox, the target starts on Production.
    await expect(dialog.getByRole('combobox', { name: /Copy to/ })).toHaveText(/Production/)
    await expect(dialog.getByText(/go live in/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Copy plans and features' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(/Copying plans and features to/)).toBeVisible()
  })
})

test.describe('environment create', () => {
  test('opens as a dialog from the environment switcher and closes on cancel', async ({ page }) => {
    await page.goto('/customers')
    await page.getByRole('button', { name: /Change environment/ }).click()
    await page.getByRole('menuitem', { name: 'New environment' }).click()
    await expect(page).toHaveURL(/\/customers/)

    const dialog = page.getByRole('dialog', { name: 'Create environment' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('radio', { name: /sandbox/i })).toBeChecked()
    // V1's sandbox warning, then V1's way to ask for production.
    await expect(dialog.getByText(/automatically cancelled after 45 days/i)).toBeVisible()
    await dialog.getByRole('radio', { name: /production/i }).click()
    await expect(dialog.getByText(/require an approval/i)).toBeVisible()
    await expect(dialog.getByRole('link', { name: /slack/i })).toHaveAttribute(
      'href',
      /join\.slack\.com\/t\/flexpricecommunity/,
    )
    await expect(dialog.getByRole('link', { name: /email/i })).toHaveAttribute(
      'href',
      'mailto:support@flexprice.io',
    )
    await expect(dialog.getByRole('link', { name: /book a call/i })).toHaveAttribute(
      'href',
      /calendly\.com/,
    )
    await expect(dialog.getByRole('button', { name: 'Create environment' })).toBeDisabled()

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/customers/)
  })

  // Environments are managed from the shell's environment switcher now, not
  // from Settings, so the old create address lands on home where it lives.
  test('the old /environments/new address lands on home', async ({ page }) => {
    await page.goto('/environments/new')
    await expect(page).toHaveURL((url) => url.pathname === '/')
  })
})
