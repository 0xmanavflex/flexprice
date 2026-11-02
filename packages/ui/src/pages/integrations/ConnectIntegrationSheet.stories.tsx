import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { INTEGRATION_CATALOG, type Integration } from '@fp/domain'
import { ConnectIntegrationSheet } from './ConnectIntegrationSheet'
import { IntegrationLogo } from './IntegrationsBlock'

function integration(id: string): Integration {
  const spec = INTEGRATION_CATALOG.find((item) => item.id === id)!
  return { ...spec, connections: [] }
}

const meta = {
  title: 'App/Integrations/Connect sheet',
  component: ConnectIntegrationSheet,
  parameters: { layout: 'fullscreen' },
  args: {
    integration: integration('razorpay'),
    logo: <IntegrationLogo integration={integration('razorpay')} />,
    context: {
      webhookBaseUrl: 'https://api.flexprice.io/v1',
      tenantId: 'tenant_demo',
      environmentId: 'env_demo',
      redirectUri: 'https://app.flexprice.io/tools/integrations/oauth/callback',
    },
    onClose: fn(),
    onSubmit: fn(async () => 'conn_new'),
  },
} satisfies Meta<typeof ConnectIntegrationSheet>

export default meta
type Story = StoryObj<typeof meta>

const screenOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** Steps: credentials, what to sync, then the webhook address before its signing secret. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const screen = screenOf(canvasElement)
    await expect(await screen.findByText('Connect Razorpay')).toBeInTheDocument()
    await expect(screen.getByLabelText(/Connection name/)).toHaveValue('Razorpay')
    await expect(screen.getByLabelText(/Key secret/, { selector: 'input' })).toHaveAttribute(
      'type',
      'password',
    )
  },
}

/** Secrets are hidden until the reader asks, and the button says which one it reveals. */
export const RevealsASecret: Story = {
  play: async ({ canvasElement }) => {
    const screen = screenOf(canvasElement)
    const secret = await screen.findByLabelText(/Key secret/, { selector: 'input' })
    await userEvent.click(screen.getByRole('button', { name: 'Show Key secret' }))
    await expect(secret).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Hide Key secret' }))
    await expect(secret).toHaveAttribute('type', 'password')
  },
}

/** Continue is gated on the step's required fields. */
export const BlocksOnMissingKeys: Story = {
  play: async ({ canvasElement }) => {
    const screen = screenOf(canvasElement)
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await expect((await screen.findAllByText(/required/i)).length).toBeGreaterThan(0)
    await expect(screen.queryByText('Push invoices')).not.toBeInTheDocument()
  },
}

/** A full pass: keys, sync, webhook, then the API body with secrets in `encrypted_secret_data`. */
export const SubmitsThePayload: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = screenOf(canvasElement)
    await userEvent.type(await screen.findByLabelText(/Key ID/), 'rzp_test_abc')
    await userEvent.type(screen.getByLabelText(/Key secret/, { selector: 'input' }), 'shh')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(await screen.findByRole('switch', { name: 'Push invoices' }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await expect(await screen.findByText('Webhook URL')).toBeInTheDocument()
    await expect(
      screen.getByText('https://api.flexprice.io/v1/webhooks/razorpay/tenant_demo/env_demo'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Connect Razorpay' }))
    await expect(await screen.findByText('Webhook signing secret is required.')).toBeVisible()
    expect(args.onSubmit).not.toHaveBeenCalled()
    await userEvent.type(
      screen.getByLabelText(/Webhook signing secret/, { selector: 'input' }),
      'whsec_test',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Connect Razorpay' }))
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledOnce())
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_type: 'razorpay',
        encrypted_secret_data: {
          key_id: 'rzp_test_abc',
          secret_key: 'shh',
          webhook_secret: 'whsec_test',
        },
        sync_config: { invoice: { outbound: true } },
      }),
      expect.anything(),
    )
  },
}

/**
 * Entities on: the connection is for an entity (one that already has Razorpay
 * is not choosable); the Webhook step shows its own address before create, and
 * one submit sends the signing secret with the keys.
 */
export const PerEntityWithItsOwnWebhook: Story = {
  args: {
    integration: {
      ...integration('razorpay'),
      connections: [
        {
          id: 'conn_us',
          name: 'Razorpay US',
          providerType: 'razorpay',
          syncConfig: {},
          metadata: {},
          billingEntityId: 'be_us',
        },
      ],
    },
    entities: [
      { id: 'be_us', name: 'Northwind US', isDefault: true },
      { id: 'be_uk', name: 'Northwind UK', isDefault: false },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const screen = screenOf(canvasElement)
    await userEvent.click(await screen.findByRole('combobox', { name: /Billing entity/ }))
    await expect(await screen.findByRole('option', { name: /Northwind US/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(screen.getByRole('option', { name: /Northwind UK/ }))
    await userEvent.type(screen.getByLabelText(/Key ID/), 'rzp_test_abc')
    await userEvent.type(screen.getByLabelText(/Key secret/, { selector: 'input' }), 'shh')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    // The address names the connection before it exists, so the secret goes in the same submit.
    const url = await screen.findByText(
      /^https:\/\/api\.flexprice\.io\/v1\/webhooks\/razorpay\/tenant_demo\/env_demo\/conn_[0-9A-HJKMNP-TV-Z]{26}$/,
    )
    const id = url.textContent?.split('/').pop()
    await userEvent.type(
      screen.getByLabelText(/Webhook signing secret/, { selector: 'input' }),
      'whsec',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Connect Razorpay' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          billing_entity_id: 'be_uk',
          encrypted_secret_data: {
            key_id: 'rzp_test_abc',
            secret_key: 'shh',
            webhook_secret: 'whsec',
          },
        }),
        expect.anything(),
      ),
    )
    await waitFor(() => expect(args.onClose).toHaveBeenCalled())
  },
}

/** With entities on, an OAuth provider also shows its webhook before the reader leaves for consent. */
export const OAuthPerEntityWebhook: Story = {
  args: {
    integration: integration('quickbooks'),
    logo: null,
    entities: [{ id: 'be_us', name: 'Northwind US', isDefault: true }],
  },
  play: async ({ canvasElement }) => {
    const screen = screenOf(canvasElement)
    await expect(await screen.findByRole('button', { name: /Webhook/ })).toBeInTheDocument()
  },
}

/** QuickBooks sends the reader to Intuit to approve access, so the redirect URI is shown up front. */
export const OAuthProvider: Story = {
  args: { integration: integration('quickbooks'), logo: null },
  play: async ({ canvasElement }) => {
    const screen = screenOf(canvasElement)
    await expect(await screen.findByText('Redirect URI')).toBeInTheDocument()
    await expect(
      screen.getByText('https://app.flexprice.io/tools/integrations/oauth/callback'),
    ).toBeInTheDocument()
  },
}

/** The API's own reason is shown, for instance when a connection already exists. */
export const WithError: Story = {
  args: { error: 'A connection for razorpay already exists in this environment' },
  play: async ({ canvasElement }) => {
    const screen = screenOf(canvasElement)
    await expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/)
  },
}

export const Pending: Story = {
  args: { isPending: true },
}

/** No integration selected: the sheet is closed. */
export const Closed: Story = {
  args: { integration: null },
  play: async ({ canvasElement }) => {
    await expect(screenOf(canvasElement).queryByRole('dialog')).not.toBeInTheDocument()
  },
}
