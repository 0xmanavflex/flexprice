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

/**
 * The debugger answers "why is this not on the invoice?".
 *
 * The unit tests cover the parsing and the stories cover the rendering; this
 * covers the request actually being made and its answer reaching the sheet,
 * which is the part that can be right in both halves and wrong in between.
 */
test('opening an event traces it through the five stages', async ({ page }) => {
  await page.goto('/events')
  await expect(page.getByRole('table')).toBeVisible({ timeout: 45_000 })

  await page.getByRole('table').getByRole('row').nth(1).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('What happened to this event')).toBeVisible({ timeout: 20_000 })

  // Named in billing terms, not the wire's stage keys.
  await expect(sheet.getByText('Customer matched')).toBeVisible()
  await expect(sheet.getByText('Meter matched')).toBeVisible()
  await expect(sheet.getByText('Counted towards usage')).toBeVisible()

  // And the payload is still there underneath.
  await expect(sheet.getByText('Properties')).toBeVisible()
})
