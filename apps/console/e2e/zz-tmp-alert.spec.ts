import { test } from './fixtures'
test.beforeEach(async ({ context }) => {
  await context.addInitScript((value) => { window.localStorage.setItem('flexprice.session', value) },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }))
})
test('shot', async ({ page }) => {
  test.setTimeout(120000)
  const log: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(m.text().slice(0,300)) })
  page.on('response', (r) => { if (r.url().includes('/v1/') || r.url().includes('settings')) log.push('RESP ' + r.status() + ' ' + r.url()) })
  page.on('pageerror', (e) => log.push('PAGEERR ' + e.message))
  await page.goto('/customers')
  await page.getByRole('row').nth(1).waitFor()
  await page.goto('/settings?section=alerts&tab=wallet-alerts')
  await page.waitForTimeout(8000)
  await page.screenshot({ path: '/tmp/claude-0/-home-user/c88b4aa8-bed5-513f-be6c-e860f3b99d4d/scratchpad/alert-settings.png', fullPage: true })
  console.log(log.filter((l) => !l.includes('script tag')).join('\n'))
})
