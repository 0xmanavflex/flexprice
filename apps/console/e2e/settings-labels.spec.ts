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

const isWrite = (method: string, path: RegExp) => (r: { method(): string; url(): string }) =>
  r.method() === method && path.test(new URL(r.url()).pathname)

test.describe('Settings → Labels', () => {
  test('/labels lands on the Labels tab in Settings', async ({ page }) => {
    await page.goto('/labels')
    await expect(page).toHaveURL(/\/settings\?section=labels&tab=labels$/)
    await expect(page.getByRole('heading', { name: 'Labels' }).first()).toBeVisible()
  })

  test('creates a label in a dialog without leaving Settings', async ({ page }) => {
    await page.goto('/settings?section=labels&tab=labels')
    await page.getByRole('button', { name: 'New label' }).click()

    const dialog = page.getByRole('dialog', { name: 'New label' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create label' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name').fill('EU region')
    await dialog.getByLabel('Lookup key').fill('eu-region')

    const request = page.waitForRequest(isWrite('POST', /\/v1\/groups$/))
    await dialog.getByRole('button', { name: 'Create label' }).click()
    await request

    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/settings\?section=labels&tab=labels$/)
  })
})
