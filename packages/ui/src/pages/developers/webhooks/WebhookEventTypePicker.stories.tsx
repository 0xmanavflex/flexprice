import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WebhookEventTypePicker } from './WebhookEventTypePicker'
import { DEMO_WEBHOOK_EVENT_TYPES } from './webhookFixtures'

const meta = {
  title: 'App/Developers/Webhooks/Event type picker',
  component: WebhookEventTypePicker,
  parameters: { layout: 'padded' },
  args: { eventTypes: DEMO_WEBHOOK_EVENT_TYPES, selected: [], onChange: fn() },
  render: function Render(args) {
    const [selected, setSelected] = useState(args.selected)
    return (
      <WebhookEventTypePicker
        {...args}
        selected={selected}
        onChange={(next) => {
          setSelected(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof WebhookEventTypePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/receives every event type/)).toBeInTheDocument()
    await userEvent.click(canvas.getByText('invoice.payment'))
    await expect(args.onChange).toHaveBeenLastCalledWith([
      'invoice.payment.failed',
      'invoice.payment.succeeded',
    ])
  },
}

export const Searching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Search event types'), 'wallet')
    await expect(canvas.getByText('wallet.credit_balance.dropped')).toBeInTheDocument()
    await expect(canvas.queryByText('invoice.finalized')).not.toBeInTheDocument()
  },
}

export const Loading: Story = { args: { eventTypes: [], isLoading: true } }
