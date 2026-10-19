import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { WebhookStatusFilter } from '@fp/domain'
import { WebhookAttemptList } from './WebhookAttemptList'
import { WebhookEndpointDetail, type WebhookEndpointTab } from './WebhookEndpointDetail'
import {
  DEMO_WEBHOOK_ENDPOINTS,
  DEMO_WEBHOOK_EVENT_TYPES,
  DEMO_WEBHOOK_HEADERS,
  DEMO_WEBHOOK_MESSAGES,
  DEMO_WEBHOOK_STATS,
} from './webhookFixtures'

const endpoint = DEMO_WEBHOOK_ENDPOINTS[0]!

function Attempts() {
  const [status, setStatus] = useState<WebhookStatusFilter>('all')
  return (
    <WebhookAttemptList
      messages={
        status === 'all'
          ? DEMO_WEBHOOK_MESSAGES
          : DEMO_WEBHOOK_MESSAGES.filter((message) => message.status === status)
      }
      status={status}
      onStatusChange={setStatus}
      onOpen={fn()}
      onResend={fn()}
      locale="en-US"
    />
  )
}

const meta = {
  title: 'App/Developers/Webhooks/Endpoint detail',
  component: WebhookEndpointDetail,
  parameters: { layout: 'fullscreen' },
  args: {
    endpoint,
    stats: DEMO_WEBHOOK_STATS[endpoint.id] ?? null,
    eventTypes: DEMO_WEBHOOK_EVENT_TYPES,
    tab: 'overview',
    onTabChange: fn(),
    onBack: fn(),
    onUpdate: fn(async () => undefined),
    onDelete: fn(async () => undefined),
    onRecover: fn(async () => undefined),
    onSendExample: fn(async () => undefined),
    secret: {
      revealed: false,
      onRevealedChange: fn(),
      value: null,
      onRotate: fn(async () => undefined),
    },
    headers: DEMO_WEBHOOK_HEADERS,
    onSetHeader: fn(async () => undefined),
    onRemoveHeader: fn(async () => undefined),
    attempts: <Attempts />,
    locale: 'en-US',
  },
  render: function Render(args) {
    const [tab, setTab] = useState<WebhookEndpointTab>(args.tab)
    const [revealed, setRevealed] = useState(args.secret.revealed)
    return (
      <WebhookEndpointDetail
        {...args}
        tab={tab}
        onTabChange={(next) => {
          setTab(next)
          args.onTabChange(next)
        }}
        secret={{
          ...args.secret,
          revealed,
          value: revealed ? 'whsec_STORYBOOK_not_a_real_secret' : null,
          onRevealedChange: setRevealed,
        }}
      />
    )
  },
} satisfies Meta<typeof WebhookEndpointDetail>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Production billing sync')).toBeInTheDocument()
    await expect(canvas.getByText('invoice.payment.failed', { selector: 'li' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Reveal signing secret' }))
    await expect(canvas.getByRole('textbox', { name: 'Signing secret' })).toHaveValue(
      'whsec_STORYBOOK_not_a_real_secret',
    )
  },
}

export const Testing: Story = {
  args: { tab: 'testing' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Send an example')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Send example' })).toBeDisabled()
  },
}

export const Advanced: Story = {
  args: { tab: 'advanced' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Hidden (sensitive)')).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('Header name'), 'X-Region')
    await userEvent.type(canvas.getByLabelText('Header value'), 'eu')
    await userEvent.click(canvas.getByRole('button', { name: 'Add header' }))
    await waitFor(() => expect(args.onSetHeader).toHaveBeenCalledWith('X-Region', 'eu'))
  },
}

export const Disabled: Story = {
  args: {
    endpoint: DEMO_WEBHOOK_ENDPOINTS[2]!,
    stats: DEMO_WEBHOOK_STATS[DEMO_WEBHOOK_ENDPOINTS[2]!.id] ?? null,
  },
}

/** Before the first delivery, the Delivery card is a setup checklist with a way to send one now. */
export const NoDeliveriesYet: Story = {
  args: { stats: { succeeded: 0, failed: 0, pending: 0, sending: 0 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No deliveries yet')).toBeVisible()
    await expect(canvas.getByRole('list', { name: 'Delivery setup' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Send example event' }))
    await waitFor(() => expect(args.onTabChange).toHaveBeenCalledWith('testing'))
  },
}
