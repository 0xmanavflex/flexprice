import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { INTEGRATION_CATALOG, type Integration, type IntegrationConnection } from '@fp/domain'
import { ManageConnectionSheet } from './ManageConnectionSheet'
import { IntegrationLogo } from './IntegrationsBlock'

function connected(id: string, connection: IntegrationConnection): Integration {
  const spec = INTEGRATION_CATALOG.find((item) => item.id === id)!
  return { ...spec, connections: 1, connection }
}

const stripe = connected('stripe', {
  id: 'conn_stripe',
  name: 'Stripe (live)',
  providerType: 'stripe',
  syncConfig: { invoice: { outbound: true } },
  metadata: {},
  createdAt: '2026-08-12T09:30:00Z',
})

const meta = {
  title: 'App/Integrations/Manage connection sheet',
  component: ManageConnectionSheet,
  parameters: { layout: 'fullscreen' },
  args: {
    integration: stripe,
    logo: <IntegrationLogo integration={stripe} />,
    context: {
      webhookBaseUrl: 'https://api.flexprice.io/v1',
      tenantId: 'tenant_demo',
      environmentId: 'env_demo',
      redirectUri: 'https://app.flexprice.io/tools/integrations/oauth/callback',
    },
    onClose: fn(),
    onSave: fn(),
    onDisconnect: fn(),
  },
} satisfies Meta<typeof ManageConnectionSheet>

export default meta
type Story = StoryObj<typeof meta>

const screenOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** Stripe: rename, sync switches (customers too, for Stripe Tax), replaceable keys and the webhook address. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const screen = screenOf(canvasElement)
    await expect(await screen.findByLabelText(/Connection name/)).toHaveValue('Stripe (live)')
    await expect(screen.getByRole('switch', { name: 'Push invoices' })).toBeChecked()
    await expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  },
}

/** Only what changed is sent. */
export const SavesOnlyChanges: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = screenOf(canvasElement)
    const name = await screen.findByLabelText(/Connection name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Stripe (prod)')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalledOnce())
    await expect(args.onSave).toHaveBeenCalledWith('conn_stripe', { name: 'Stripe (prod)' })
  },
}

/** A Stripe key can be replaced; left blank, the stored one is kept and not sent. */
export const ReplacesAKey: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = screenOf(canvasElement)
    await userEvent.type(await screen.findByLabelText(/^Secret key/), 'sk_live_new')
    await userEvent.click(screen.getByRole('switch', { name: 'Push customers' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalledOnce())
    await expect(args.onSave).toHaveBeenCalledWith(
      'conn_stripe',
      expect.objectContaining({
        encrypted_secret_data: { secret_key: 'sk_live_new' },
        sync_config: expect.objectContaining({ customer: { outbound: true } }),
      }),
    )
  },
}

/** Disconnecting asks first, and says it archives the connection. */
export const ConfirmsDisconnect: Story = {
  // The soft `destructive` button variant is 3.82:1 by design; see ConfirmDialog.stories.
  parameters: { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } },
  play: async ({ canvasElement, args }) => {
    const screen = screenOf(canvasElement)
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect Stripe' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disconnect Stripe?' })
    await expect(dialog).toHaveTextContent(/archives this connection/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }))
    await expect(args.onDisconnect).toHaveBeenCalledWith('conn_stripe')
  },
}

export const SaveFailed: Story = {
  args: { saveError: 'Could not reach Flexprice.' },
  play: async ({ canvasElement }) => {
    await expect(await screenOf(canvasElement).findByRole('alert')).toHaveTextContent(
      /Could not reach/,
    )
  },
}

export const Closed: Story = {
  args: { integration: null },
}
