import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { INTEGRATION_CATALOG, type Integration } from '@fp/domain'
import { IntegrationGrid } from './IntegrationGrid'

const integrations: Integration[] = INTEGRATION_CATALOG.map((spec) => ({
  ...spec,
  connections: spec.id === 'stripe' ? 1 : spec.id === 'quickbooks' ? 2 : 0,
}))

const meta = {
  title: 'Surfaces/IntegrationGrid',
  component: IntegrationGrid,
  parameters: { layout: 'padded' },
  args: { integrations, onRetry: fn() },
} satisfies Meta<typeof IntegrationGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const stripe = within(await canvas.findByTestId('integration-stripe'))
    await expect(stripe.getByText('Connected')).toBeInTheDocument()
    await expect(within(canvas.getByTestId('integration-quickbooks')).getByText('Connected (2)')).toBeInTheDocument()
    await expect(within(canvas.getByTestId('integration-razorpay')).getByText('Not connected')).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Premium add-ons' })).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const Failed: Story = {
  args: { error: 'The server did not answer.' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  },
}
