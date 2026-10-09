import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WebhookAttemptList } from './WebhookAttemptList'
import { DEMO_WEBHOOK_MESSAGES } from './webhookFixtures'

const meta = {
  title: 'Surfaces/Webhooks/WebhookAttemptList',
  component: WebhookAttemptList,
  parameters: { layout: 'padded' },
  args: {
    messages: DEMO_WEBHOOK_MESSAGES,
    status: 'all',
    onStatusChange: fn(),
    onRefresh: fn(),
    onOpen: fn(),
    onResend: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof WebhookAttemptList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Succeeded')).toBeInTheDocument()
    await expect(canvas.getByText('Failed')).toBeInTheDocument()
    await userEvent.click(canvas.getByText('invoice.finalized'))
    await expect(args.onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg_2mW0C5zA6bB7cC8dD9eE0fF1' }),
    )
  },
}

export const FilteredToFailed: Story = {
  args: {
    status: 'failed',
    messages: DEMO_WEBHOOK_MESSAGES.filter((message) => message.status === 'failed'),
  },
}

export const Empty: Story = { args: { messages: [] } }
