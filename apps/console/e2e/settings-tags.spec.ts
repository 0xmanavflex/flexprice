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

const isWrite = (method: string, path: RegExp) => (r: { method(): string; url(): string }) =>
  r.method() === method && path.test(new URL(r.url()).pathname)

test.describe('Settings → Tags', () => {
  test('/labels, the old address, lands on the Tags tab in Settings', async ({ page }) => {
    await page.goto('/labels')
    await expect(page).toHaveURL(/\/settings\?section=tags&tab=tags$/)
    // No visible title: the section opens straight onto its table. The heading
    // is still there for assistive tech, and the rail row is selected.
    await expect(page.getByRole('heading', { name: 'Tags' }).first()).toBeAttached()
    await expect(
      page.getByRole('navigation', { name: 'Settings' }).getByRole('button', { name: 'Tags' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('an old ?section=labels link resolves to Tags', async ({ page }) => {
    await page.goto('/settings?section=labels&tab=labels')
    await expect(
      page.getByRole('navigation', { name: 'Settings' }).getByRole('button', { name: 'Tags' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('creates a tag in a dialog without leaving Settings', async ({ page }) => {
    await page.goto('/settings?section=tags&tab=tags')
    await page.getByRole('button', { name: 'New tag' }).first().click()

    const dialog = page.getByRole('dialog', { name: 'New tag' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create tag' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name').fill('EU region')
    await dialog.getByLabel('Lookup key').fill('eu-region')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/groups$/))
    await dialog.getByRole('button', { name: 'Create tag' }).click()
    await request

    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/settings\?section=tags&tab=tags$/)
  })
})

test.describe('a tag and a coupon open inside Settings', () => {
  const settingsRail = (page: import('@playwright/test').Page, name: string) =>
    page.getByRole('navigation', { name: 'Settings' }).getByRole('button', { name })

  test('a tag row has one menu, and View tag opens its page under Tags', async ({ page }) => {
    await page.goto('/settings?section=tags&tab=tags')
    const menu = page.getByRole('button', { name: /^Actions for / }).first()
    await expect(menu).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveCount(0)

    await menu.click()
    await expect(page.getByRole('menuitem', { name: 'Copy tag ID' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete tag' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'View tag' }).click()

    await expect(page).toHaveURL(/\/groups\/[^/?]+/)
    await expect(page.getByRole('tab', { name: 'Information' })).toBeVisible()
    await expect(settingsRail(page, 'Tags')).toHaveAttribute('aria-current', 'page')
  })

  test('a coupon page sits under Coupons in Settings', async ({ page }) => {
    await page.goto('/coupons')
    const row = page.getByRole('row').nth(1)
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.click()

    await expect(page).toHaveURL(/\/coupons\/[^/?]+/)
    await expect(settingsRail(page, 'Coupons')).toHaveAttribute('aria-current', 'page')
  })
})
