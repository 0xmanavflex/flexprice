import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ShellPage } from './pages/shell'

/**
 * A shared link to a record in another environment.
 *
 * `/invoices/<id>` names the invoice, not its environment, and whoever opens
 * it is in whichever environment their console last used — Sandbox, on a
 * fresh sign-in. The mocks keep one invoice in Production only: opened from
 * Sandbox it 404s, as a real record elsewhere does. The console must look in
 * the other environments, switch to the one that has it and show it, rather
 * than say "Invoice not found".
 */
const PRODUCTION_ONLY_INVOICE = 'inv_01PRODUCTIONONLYDEMO000001'
const SANDBOX = 'env_01KVSNYVPMAP6JJGDF177V2DE6'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ({ session, sandbox }) => {
      try {
        window.localStorage.setItem('flexprice.session', session)
        // Only on the first load: the switch writes Production, and a reload must keep it.
        if (!window.sessionStorage.getItem('seeded')) {
          window.localStorage.setItem('flexprice.environment', sandbox)
          window.sessionStorage.setItem('seeded', '1')
        }
      } catch {
        /* private mode */
      }
    },
    {
      session: JSON.stringify({
        token: 'mock_demo_token',
        userId: 'user_demo',
        tenantId: 'tenant_demo',
      }),
      sandbox: SANDBOX,
    },
  )
})

test('opens a shared invoice from another environment, and switches there', async ({ page }) => {
  await page.goto(`/invoices/${PRODUCTION_ONLY_INVOICE}`)

  await expect(page.getByText('Switched to Production')).toBeVisible()
  await expect(page.getByRole('tab', { name: /Invoice details/ })).toBeVisible()
  await expect(page.getByText('Invoice not found')).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/invoices/${PRODUCTION_ONLY_INVOICE}$`))

  // The console stays in Production: a reload opens the invoice straight away.
  await page.reload()
  await expect(page.getByRole('tab', { name: /Invoice details/ })).toBeVisible()
  await expect(page.getByText('Switched to Production')).toHaveCount(0)
})

test('a record no environment has is still "not found"', async ({ page }) => {
  await page.goto('/invoices/inv_01DOESNOTEXISTANYWHERE00000')
  await expect(page.getByText('Invoice not found')).toBeVisible()
})

/** The environment a page's address names (`?env=`), once it has one. */
async function environmentInUrl(page: Page): Promise<string> {
  await expect.poll(() => new URL(page.url()).searchParams.get('env') ?? '').not.toBe('')
  return new URL(page.url()).searchParams.get('env') ?? ''
}

test('every page names its environment in the address', async ({ page }) => {
  await page.goto('/customers')
  const shell = new ShellPage(page)
  await expect(shell.environment).toBeVisible({ timeout: 20_000 })
  const current = await environmentInUrl(page)

  // In-app navigation keeps it.
  await page.getByRole('button', { name: 'Contracts' }).first().click()
  await expect(page).toHaveURL(/\/contracts/)
  expect(await environmentInUrl(page)).toBe(current)
})

test('a shared link opens in the environment it names', async ({ page }) => {
  await page.goto('/customers')
  const shell = new ShellPage(page)
  await expect(shell.environment).toBeVisible({ timeout: 20_000 })
  const home = await environmentInUrl(page)
  const homeName = await shell.currentEnvironment()

  // Learn another environment's id and name from the switcher, not a fixture.
  await shell.environment.click()
  const other = page
    .getByRole('menuitem')
    .filter({ hasNot: page.locator('[aria-current]') })
    .first()
  const otherName = ((await other.textContent()) ?? '').trim()
  await other.click()
  await expect.poll(() => environmentInUrl(page)).not.toBe(home)
  const shared = await environmentInUrl(page)
  await shell.switchEnvironment(homeName)
  await expect.poll(() => environmentInUrl(page)).toBe(home)

  // A link copied in that other environment opens there.
  await page.goto(`/contracts?env=${shared}`)
  await expect(page.getByText(`Switched to ${otherName}`)).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/\/contracts/)
  expect(await environmentInUrl(page)).toBe(shared)
})

test('a link to an environment you cannot reach opens in your own', async ({ page }) => {
  await page.goto('/customers')
  const shell = new ShellPage(page)
  await expect(shell.environment).toBeVisible({ timeout: 20_000 })
  const own = await environmentInUrl(page)

  await page.goto('/customers?env=env_NOTONEOFYOURS')
  await expect(shell.environment).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => environmentInUrl(page)).toBe(own)
  await expect(page.getByText(/^Switched to/)).toHaveCount(0)
})
