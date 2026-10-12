import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* private-mode browser */
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
})

/**
 * Home leads with the work waiting for a person. The mock book always holds unpaid invoices past
 * their term, so the overdue task is there, and opening it lands on the Invoices list already
 * narrowed to overdue.
 */
test('Home lists overdue invoices as a task and opens them filtered', async ({ page }) => {
  await page.goto('/')

  const panel = page.getByRole('region', { name: /needs attention/i })
  const overdue = panel.getByRole('button', { name: /overdue invoices?/i })
  await expect(overdue).toBeVisible()
  await expect(overdue).toContainText('Urgent')

  await overdue.click()

  await expect(page).toHaveURL(/\/invoices\?.*status=overdue/)
})
