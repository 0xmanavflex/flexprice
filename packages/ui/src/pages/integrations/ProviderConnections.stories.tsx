import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { INTEGRATION_CATALOG, type Integration } from '@fp/domain'
import { IntegrationLogo } from './IntegrationsBlock'
import { ProviderConnections } from './ProviderConnections'

const entities = [
  { id: 'be_us', name: 'Northwind US', isDefault: true },
  { id: 'be_eu', name: 'Northwind EU', isDefault: false },
  { id: 'be_uk', name: 'Northwind UK', isDefault: false },
]

const stripe: Integration = {
  ...INTEGRATION_CATALOG.find((item) => item.id === 'stripe')!,
  connections: [
    {
      id: 'conn_us',
      name: 'Stripe US',
      providerType: 'stripe',
      syncConfig: {},
      metadata: {},
      billingEntityId: null,
    },
    {
      id: 'conn_eu',
      name: 'Stripe EU',
      providerType: 'stripe',
      syncConfig: {},
      metadata: {},
      billingEntityId: 'be_eu',
    },
  ],
}

/** One provider across the billing entities: the connection each owns, and Connect where there is none. */
const meta = {
  title: 'App/Integrations/Provider connections',
  component: ProviderConnections,
  parameters: { layout: 'fullscreen' },
  args: {
    integration: stripe,
    logo: <IntegrationLogo integration={stripe} />,
    entities,
    onBack: fn(),
    onConfigure: fn(),
    onConnect: fn(),
  },
} satisfies Meta<typeof ProviderConnections>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Stripe' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Configure Stripe EU' }))
    await expect(args.onConfigure).toHaveBeenCalledWith(stripe.connections[1])
    await userEvent.click(canvas.getByRole('button', { name: 'Connect Northwind UK' }))
    await expect(args.onConnect).toHaveBeenCalledWith(entities[2])
  },
}

/** A connection saved without its webhook secret says so beside its name. */
export const FlagsAMissingWebhook: Story = {
  args: {
    integration: {
      ...stripe,
      connections: [
        { ...stripe.connections[0]!, webhookSecretSet: true },
        { ...stripe.connections[1]!, webhookSecretSet: false },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rowOf = (name: string) => canvas.getByRole('row', { name: new RegExp(name) })
    await expect(await canvas.findByRole('heading', { name: 'Stripe' })).toBeInTheDocument()
    await expect(rowOf('Northwind EU')).toHaveTextContent('Webhook not set up')
    await expect(rowOf('Northwind US')).not.toHaveTextContent('Webhook not set up')
  },
}

/** A provider that posts no webhooks never shows the flag. */
export const NoWebhookProvider: Story = {
  args: {
    integration: {
      ...INTEGRATION_CATALOG.find((item) => item.id === 'tabs')!,
      connections: [
        {
          id: 'conn_tabs',
          name: 'Tabs EU',
          providerType: 'tabs',
          syncConfig: {},
          metadata: {},
          billingEntityId: 'be_eu',
          webhookSecretSet: false,
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Tabs EU')).toBeInTheDocument()
    await expect(canvas.queryByText('Webhook not set up')).not.toBeInTheDocument()
  },
}
