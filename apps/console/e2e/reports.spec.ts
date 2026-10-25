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

test('Reports reads the report library, and the old /revenue address lands there', async ({
  page,
}) => {
  const reports = new Set<string>()
  page.on('request', (request) => {
    const match = /\/analytics\/reports\/([^/]+)\/query$/.exec(new URL(request.url()).pathname)
    if (match?.[1]) reports.add(match[1])
  })

  await page.goto('/revenue?range=90d')
  await expect(page).toHaveURL(/\/reports/)
  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('link', { name: 'Reports' }).first()).toBeVisible()

  // The headline figures are real numbers, not the dash an absent one reads as.
  await expect(page.getByText('As of today').first()).toBeVisible()
  await expect(page.getByText(/% of outstanding/).first()).toBeVisible()

  await page.getByRole('tab', { name: 'Usage' }).click()
  await expect(page.getByText('Credits consumed', { exact: true })).toBeVisible()

  for (const key of [
    'invoice_total',
    'arpu',
    'total_receivables',
    'receivables_aging',
    'days_to_pay',
    'events_volume',
    'credit_consumption',
    'credit_topups',
  ]) {
    expect(reports, `queried ${key}`).toContain(key)
  }
})

test('Usage keeps to the 7-day limit of the events report on a 12-month range', async ({
  page,
}) => {
  await page.goto('/reports?view=usage&range=12m')
  await expect(page.getByText('Total events')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/The last 7 days/)).toBeVisible()
})

test('Home reads its revenue from the same report as Reports', async ({ page }) => {
  const reports = new Set<string>()
  page.on('request', (request) => {
    const match = /\/analytics\/reports\/([^/]+)\/query$/.exec(new URL(request.url()).pathname)
    if (match?.[1]) reports.add(match[1])
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/^\$[\d,]+\.\d{2}$/).first()).toBeVisible()
  expect(reports).toContain('invoice_total')
})
