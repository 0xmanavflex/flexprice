import { expect, test } from '@playwright/test'

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

test('opens a contract from the list and cancels it', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/]+$/)
  await expect(page.getByRole('button', { name: 'Contract actions' })).toBeVisible()

  await page.getByRole('button', { name: 'Contract actions' }).click()
  await page.getByRole('menuitem', { name: 'Cancel contract' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel contract' }).click()
  await expect(dialog).toBeHidden()
})

// The search answers active only unless told otherwise, which hid trialing
// contracts from the list and made their own page read "Contract not found".
// Found from the list rather than by a fixture id, then opened by URL: a link
// or a reload lands on the page with nothing cached.
test('opens a trialing contract instead of "not found"', async ({ page }) => {
  await page.goto('/contracts?status=trialing')
  await page.getByRole('row').filter({ hasText: 'Trialing' }).first().click({ timeout: 20_000 })
  await expect(page).toHaveURL(/\/contracts\/[^/?]+$/)
  const url = page.url()
  await page.goto('about:blank')
  await page.goto(url)
  await expect(page.getByText('Trialing').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Contract not found')).toHaveCount(0)
})

test('lists a trialing contract under the Trialing filter', async ({ page }) => {
  await page.goto('/contracts?status=trialing')
  await expect(page.getByRole('row').filter({ hasText: 'Trialing' }).first()).toBeVisible({
    timeout: 20_000,
  })
})

test('lists a trialing contract with no status filter chosen', async ({ page }) => {
  await page.goto('/contracts?size=100')
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('row').filter({ hasText: 'Trialing' }).first()).toBeVisible()
})
