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

test.describe('integrations', () => {
  test('shows the catalogue with connection status', async ({ page }) => {
    await page.goto('/integrations')

    await expect(page.getByRole('heading', { name: 'Available', level: 2 })).toBeVisible()
    await expect(page.getByTestId('integration-stripe')).toContainText('Connected')
    await expect(page.getByTestId('integration-razorpay')).toContainText('Not connected')
  })

  test('links a provider to its setup guide', async ({ page }) => {
    await page.goto('/integrations')

    const guide = page.getByRole('link', { name: /Setup guide for Stripe/ })
    await expect(guide).toHaveAttribute('href', 'https://docs.flexprice.io/integrations/stripe/')
    await expect(guide).toHaveAttribute('target', '_blank')
  })

  test('connects a provider, keeps the key hidden, and shows it connected', async ({ page }) => {
    await page.goto('/integrations')
    await page.getByRole('button', { name: 'Connect Razorpay' }).click()

    const sheet = page.getByRole('dialog', { name: /Connect Razorpay/ })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Continue' }).click()
    // Required keys are checked before anything is sent.
    await expect(sheet.getByText(/required/i).first()).toBeVisible()

    await sheet.getByLabel('Connection name').fill('Razorpay live')
    await sheet.getByLabel('Key ID').fill('rzp_test_abc123')
    const secret = sheet.locator('input[data-slot="input-group-control"]')
    await secret.fill('super-secret')
    await expect(secret).toHaveAttribute('type', 'password')
    await sheet.getByRole('button', { name: 'Show Key secret' }).click()
    await expect(secret).toHaveAttribute('type', 'text')

    // Credentials, then sync, then the webhook address.
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await expect(sheet.getByText('Push invoices')).toBeVisible()
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await expect(sheet.getByText('Webhook URL', { exact: true })).toBeVisible()
    await sheet.getByRole('button', { name: 'Connect Razorpay' }).click()

    await expect(page.getByTestId('integration-razorpay')).toContainText('Connected')
  })

  test('manages a connection and disconnects it after confirming', async ({ page }) => {
    await page.goto('/integrations')
    await page.getByRole('button', { name: 'Configure Stripe' }).click()

    const sheet = page.getByRole('dialog', { name: /Stripe/ })
    await expect(sheet.getByText('Keys are stored encrypted and cannot be shown.')).toBeVisible()
    await sheet.getByLabel('Connection name').fill('Stripe (prod)')
    await sheet.getByRole('button', { name: 'Save changes' }).click()

    await sheet.getByRole('button', { name: 'Disconnect Stripe' }).click()
    const confirm = page.getByRole('dialog', { name: 'Disconnect Stripe?' })
    await expect(confirm).toContainText('archives this connection')
    await confirm.getByRole('button', { name: 'Disconnect' }).click()

    await expect(page.getByTestId('integration-stripe')).toContainText('Not connected')
  })
})
