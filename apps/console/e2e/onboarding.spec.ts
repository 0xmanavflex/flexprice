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
  await page.getByLabel('Website').fill('https://acme.com')
  await page.getByRole('radio', { name: 'Product Hunt' }).click()

  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/$/)

  // What the mocked API saved, read back through the page (MSW serves it).
  const saved = await page.evaluate(async () => {
    const res = await fetch('https://mock.flexprice.test/v1/tenants/tenant_demo')
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
