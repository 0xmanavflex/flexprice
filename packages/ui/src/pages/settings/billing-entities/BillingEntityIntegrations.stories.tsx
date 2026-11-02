import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { INTEGRATION_CATALOG, type Integration } from '@fp/domain'
import { BillingEntityIntegrations } from './BillingEntityIntegrations'

const entities = [
  { id: 'be_us', isDefault: true },
  { id: 'be_in', isDefault: false },
]

const integrations: Integration[] = INTEGRATION_CATALOG.map((spec) => ({
  ...spec,
  connections:
    spec.id === 'razorpay'
      ? [
          {
            id: 'conn_rzp_in',
            name: 'Razorpay India',
            providerType: 'razorpay',
            syncConfig: {},
            metadata: {},
            billingEntityId: 'be_in',
          },
        ]
      : spec.id === 'stripe'
        ? [
            {
              id: 'conn_stripe',
              name: 'Stripe US',
              providerType: 'stripe',
              syncConfig: {},
              metadata: {},
              billingEntityId: null,
            },
          ]
        : [],
}))

/** A billing entity's connections by category, with Connect for the providers it lacks. */
const meta = {
  title: 'App/Settings/Billing entities/Billing entity integrations',
  component: BillingEntityIntegrations,
  parameters: { layout: 'padded' },
  args: {
    entity: { id: 'be_in' },
    entities,
    integrations,
    isLoading: false,
    failed: false,
    onRetry: fn(),
    onConnect: fn(),
  },
} satisfies Meta<typeof BillingEntityIntegrations>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const payments = canvas.getByRole('region', { name: 'Payments' })
    await expect(within(payments).getByRole('row', { name: /Razorpay India/ })).toBeVisible()
    // Stripe belongs to the default entity, so this entity can still connect one.
    await userEvent.click(within(payments).getByRole('button', { name: 'Actions for Stripe' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Connect' }))
    await expect(args.onConnect).toHaveBeenCalledWith(integrations[0])
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const Failed: Story = { args: { failed: true } }

/** The entity's connection saved without its webhook secret says so beside its name. */
export const FlagsAMissingWebhook: Story = {
  args: {
    integrations: integrations.map((integration) =>
      integration.id === 'razorpay'
        ? {
            ...integration,
            connections: integration.connections.map((c) => ({ ...c, webhookSecretSet: false })),
          }
        : integration,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('row', { name: /Razorpay India/ })).toHaveTextContent(
      'Webhook not set up',
    )
  },
}
