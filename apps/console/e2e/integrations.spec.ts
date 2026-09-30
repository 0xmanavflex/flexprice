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

test.describe('integrations', () => {
  test('shows the integrations gallery', async ({ page }) => {
    await page.goto('/integrations')

    await expect(page.getByRole('heading', { name: 'Integrations', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Disconnect' }).first()).toBeVisible()
  })

  test('toggles a connection', async ({ page }) => {
    await page.goto('/integrations')

    const disconnects = page.getByRole('button', { name: 'Disconnect' })
    await expect(disconnects.first()).toBeVisible()
    const before = await disconnects.count()
    await page.getByRole('button', { name: 'Connect', exact: true }).first().click()
    await expect(disconnects).toHaveCount(before + 1)
  })
})
