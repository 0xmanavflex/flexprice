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

test('portal: switching a section off saves and survives leaving the tab', async ({ page }) => {
  await page.goto('/settings?section=customer-experience&tab=portal')
  await expect(page.getByRole('heading', { name: 'Customer portal' })).toBeVisible()

  const group = page.getByRole('group', { name: /visibility$/ }).first()
  await group.getByRole('button', { name: 'Off' }).click()
  await expect(group.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.getByRole('button', { name: 'Onboarding' }).click()
  await page.getByRole('button', { name: 'Portal' }).click()
  await expect(
    page
      .getByRole('group', { name: /visibility$/ })
      .first()
      .getByRole('button', { name: 'Off' }),
  ).toHaveAttribute('aria-pressed', 'true')

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

  await page.getByRole('button', { name: 'Portal' }).click()
  await page.getByRole('button', { name: 'Onboarding' }).click()
  await expect(steps).toHaveCount(before + 1)
})

test('single sign-on says plainly that the deployment does not offer it', async ({ page }) => {
  await page.goto('/settings?section=team&tab=sso')
  await expect(page.getByRole('status')).toContainText(/single sign-on|SAML/i)
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
})
