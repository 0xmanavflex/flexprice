import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { WebhookEventCatalog } from './WebhookEventCatalog'
import { DEMO_WEBHOOK_EVENT_TYPES } from './webhookFixtures'

const meta = {
  title: 'App/Developers/Webhooks/Event catalog',
  component: WebhookEventCatalog,
  parameters: { layout: 'padded' },
  args: { eventTypes: DEMO_WEBHOOK_EVENT_TYPES },
} satisfies Meta<typeof WebhookEventCatalog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('invoice.finalized')).toBeInTheDocument()
    await expect(canvas.getByText('Deprecated')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /^subscription/ }))
    await expect(canvas.queryByText('invoice.finalized')).not.toBeInTheDocument()
    await expect(canvas.getByText('subscription.created')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { eventTypes: [], isLoading: true } }

export const Empty: Story = { args: { eventTypes: [] } }
