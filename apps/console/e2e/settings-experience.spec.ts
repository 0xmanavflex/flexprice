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

test('portal: switching a section off saves and survives leaving the tab', async ({ page }) => {
  await page.goto('/settings?section=customer-experience&tab=portal')
  await expect(page.getByText('Config version', { exact: true })).toBeVisible()

  const eye = page.getByRole('button', { name: /visibility$/ }).first()
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
  await eye.click()
  await expect(eye).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.getByRole('tab', { name: 'Onboarding', exact: true }).click()
  await page.getByRole('tab', { name: 'Portal', exact: true }).click()
  await expect(page.getByRole('button', { name: /visibility$/ }).first()).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await expect(page.getByText('Back to the defaults.')).toBeVisible()
})

test('onboarding: adding a step saves it into the workflow', async ({ page }) => {
  await page.goto('/settings?section=customer-experience&tab=onboarding')
  const steps = page.getByRole('button', { name: /^Move step \d+ up$/ })
  await expect(steps).toHaveCount(2)
  const before = 2

  await page.getByRole('group', { name: 'Add a step' }).getByRole('button').first().click()
  await expect(steps).toHaveCount(before + 1)

  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.getByRole('tab', { name: 'Portal', exact: true }).click()
  await page.getByRole('tab', { name: 'Onboarding', exact: true }).click()
  await expect(steps).toHaveCount(before + 1)
})

for (const tab of ['members', 'roles', 'sso']) {
  test(`team is a single page with no tab strip, and the old ${tab} link lands on it`, async ({
    page,
  }) => {
    await page.goto(`/settings?section=team&tab=${tab}`)
    await expect(page.getByRole('navigation', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('tablist')).toHaveCount(0)
  })
}
