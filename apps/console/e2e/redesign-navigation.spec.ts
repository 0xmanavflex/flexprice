import { expect, test } from './fixtures'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      'flexprice.session',
      JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
    )
  })
})

for (const [legacy, canonical, heading] of [
  ['/subscriptions', '/contracts', 'Contracts'],
  ['/credit-notes', '/credit-memos', 'Credit memos'],
  ['/products', '/features', 'Features'],
] as const) {
  test(`${legacy} redirects and retains its search across reload`, async ({ page }) => {
    await page.goto(`${legacy}?search=lumen`)
    await expect(page).toHaveURL(new RegExp(`${canonical}\\?`))
    await expect(page).toHaveURL(/search=lumen/)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/search=lumen/)
  })
}

test('a legacy contract record bookmark opens the same record', async ({ page }) => {
  await page.goto('/contracts')
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/\/contracts\/[^/?]+/)
  const canonical = new URL(page.url())
  await page.goto(canonical.pathname.replace('/contracts/', '/subscriptions/'))
  await expect(page).toHaveURL(new RegExp(canonical.pathname))
  await expect(page.getByRole('button', { name: 'Contract actions' })).toBeVisible()
})

test('API keys live under Developers, and the old Settings link still lands there', async ({
  page,
}) => {
  await page.goto('/api-keys')
  await expect(page.getByRole('button', { name: 'Create API key', exact: true })).toBeVisible()
  await page.goto('/settings?section=api-keys&tab=api-keys')
  await expect(page).toHaveURL(/\/api-keys/)
  await expect(page.getByRole('button', { name: 'Create API key', exact: true })).toBeVisible()
})
