import { type BrowserContext } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Tenant onboarding: a tenant that has not answered the three questions is
 * sent from Home to `/onboarding`, answers them, and lands back on Home. The
 * mocks play a brand-new tenant when `flexprice.mock.notOnboarded` is set.
 */
async function signIn(context: BrowserContext, { onboarded }: { onboarded: boolean }) {
  await context.addInitScript(
    ([session, fresh]) => {
      try {
        window.localStorage.setItem('flexprice.session', session)
        if (fresh) window.localStorage.setItem('flexprice.mock.notOnboarded', 'true')
        else window.localStorage.removeItem('flexprice.mock.notOnboarded')
      } catch {
        /* private-mode browser */
      }
    },
    [
      JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
      !onboarded,
    ] as const,
  )
}

test('a new tenant answers the onboarding questions, then lands on Home', async ({
  context,
  page,
}) => {
  await signIn(context, { onboarded: false })
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: 'Welcome to Flexprice' })).toBeVisible()

  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page.getByText('Enter your organization name')).toBeVisible()

  await page.getByLabel('Organization name').fill('Acme Robotics')
  await page.getByLabel('Website').fill('hello')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page.getByText('Enter a website, for example acme.com')).toBeVisible()
  await page.getByLabel('Website').fill('https://acme.com')
  await page.getByRole('radio', { name: 'Product Hunt' }).click()

  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/$/)

  // What was saved, read back for whichever tenant the session belongs to.
  const saved = await page.evaluate(async () => {
    const session = JSON.parse(window.localStorage.getItem('flexprice.session') ?? '{}') as {
      token?: string
    }
    const headers = { Authorization: `Bearer ${session.token ?? ''}` }
    const base = 'https://mock.flexprice.test/v1'
    const me = (await (await fetch(`${base}/users/me`, { headers })).json()) as {
      tenant_id?: string
      tenant?: { id?: string }
    }
    const tenantId = me.tenant_id ?? me.tenant?.id ?? ''
    const res = await fetch(`${base}/tenants/${tenantId}`, { headers })
    return (await res.json()) as { name: string; metadata: Record<string, string> }
  })
  expect(saved.name).toBe('Acme Robotics')
  expect(saved.metadata).toMatchObject({
    onboarding_completed: 'true',
    onboarding_referral_source: 'Product Hunt',
    onboarding_organization_url: 'https://acme.com',
  })

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText("You're all set!")).toBeVisible()
})

test('an onboarded tenant stays on Home, and /onboarding steps aside', async ({
  context,
  page,
}) => {
  await signIn(context, { onboarded: true })
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/')
  await expect(page).not.toHaveURL(/onboarding/)
})

test('a direct visit with no environment stored picks one before reading the tenant', async ({
  context,
  page,
}) => {
  await signIn(context, { onboarded: false })
  await context.addInitScript(() => {
    try {
      window.localStorage.removeItem('flexprice.environment')
    } catch {
      /* private-mode browser */
    }
  })
  const tenantRead = page.waitForRequest(
    (r) => r.method() === 'GET' && /\/tenants\/[^/]+$/.test(new URL(r.url()).pathname),
  )
  await page.goto('/onboarding')
  expect((await tenantRead).headers()['x-environment-id']).toBeTruthy()

  await page.getByLabel('Organization name').fill('Acme Robotics')
  await page.getByLabel('Website').fill('acme.com')
  await page.getByRole('radio', { name: 'Product Hunt' }).click()
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/$/)
})
