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

test('edits an add-on in place from its detail page', async ({ page }) => {
  await page.goto('/addons')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)

  await page.getByRole('button', { name: 'Add-on actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit add-on details' }).click()

  await page.getByLabel('Name', { exact: true }).fill('Renamed add-on')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/addons\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Renamed add-on' })).toBeVisible()
})

/*
 * One resource per test, deliberately.
 *
 * These two were a single test that walked both journeys — two cold route
 * loads and two menu flows — inside one 30s budget. It passed locally in
 * ~15s and timed out at 31.5s on a loaded CI runner, which is the worst kind
 * of red: nothing was broken, and the signal was indistinguishable from a
 * real regression. Split, each gets its own budget and neither is near it.
 */
test('edits a coupon in place from its detail page', async ({ page }) => {
  await page.goto('/coupons')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Coupon actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit coupon details' }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
})

test('edits a cost sheet in place from its detail page', async ({ page }) => {
  await page.goto('/cost-sheets')
  await page.getByRole('row').nth(1).click()
  await page.getByRole('button', { name: 'Cost sheet actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit details' }).click()
  await page.getByRole('button', { name: 'Edit cost sheet details' }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
})
