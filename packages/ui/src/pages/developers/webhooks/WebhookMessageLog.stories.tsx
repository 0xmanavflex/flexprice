import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WebhookMessageLog } from './WebhookMessageLog'
import { DEMO_WEBHOOK_EVENT_TYPES, DEMO_WEBHOOK_MESSAGES } from './webhookFixtures'

const meta = {
  title: 'Surfaces/Webhooks/WebhookMessageLog',
  component: WebhookMessageLog,
  parameters: { layout: 'padded' },
  args: {
    messages: DEMO_WEBHOOK_MESSAGES,
    eventTypes: DEMO_WEBHOOK_EVENT_TYPES.map((eventType) => eventType.name),
    eventType: '',
    onEventTypeChange: fn(),
    onRefresh: fn(),
    onOpen: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof WebhookMessageLog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByText('invoice.payment.failed'))
    await expect(args.onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg_2mW0B8nO9pQ0rS1tU2vW3xY4' }),
    )
  },
}

export const Empty: Story = { args: { messages: [] } }

export const Loading: Story = { args: { messages: [], isLoading: true } }
