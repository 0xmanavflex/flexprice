import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WebhookEndpointGrid } from './WebhookEndpointGrid'
import { DEMO_WEBHOOK_ENDPOINTS, DEMO_WEBHOOK_STATS } from './webhookFixtures'

const meta = {
  title: 'App/Developers/Webhooks/Endpoint table',
  component: WebhookEndpointGrid,
  parameters: { layout: 'padded' },
  args: {
    endpoints: DEMO_WEBHOOK_ENDPOINTS,
    stats: DEMO_WEBHOOK_STATS,
    onOpen: fn(),
    onCreate: fn(),
    onViewCatalog: fn(),
    onToggleDisabled: fn(),
    onDelete: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof WebhookEndpointGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Production billing sync')).toBeInTheDocument()
    await expect(canvas.getByText('All events')).toBeInTheDocument()
    await expect(canvas.getByText('Disabled')).toBeInTheDocument()
    await expect(canvas.getByText('50%')).toBeInTheDocument()
    await userEvent.click(canvas.getByText('Finance alerts channel'))
    await expect(args.onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ep_2mVxS1pD4uJ6eW8hT2bQ5nX7' }),
    )
  },
}

export const Searching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByRole('textbox'), 'staging')
    await expect(
      await canvas.findByText('https://staging.northwind.dev/webhooks'),
    ).toBeInTheDocument()
    await expect(canvas.queryByText('Production billing sync')).not.toBeInTheDocument()
  },
}

export const StatsLoading: Story = { args: { stats: undefined } }

export const Empty: Story = {
  args: { endpoints: [] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No endpoints yet')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Browse event catalog' }))
    await expect(args.onViewCatalog).toHaveBeenCalled()
  },
}

export const Loading: Story = { args: { endpoints: [], isLoading: true } }

export const Failed: Story = {
  args: {
    endpoints: [],
    error: 'Could not reach the webhook service.',
    errorKind: 'network',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Could not reach')
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** A permission failure is not retryable, so no retry is offered. */
export const FailedDenied: Story = {
  args: {
    endpoints: [],
    error: 'Your role does not include access to webhooks.',
    errorKind: 'denied',
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  },
}

/** An endpoint that has delivered nothing has no error rate: a dash, never "0%". */
export const NoDeliveriesYet: Story = {
  args: {
    stats: Object.fromEntries(
      DEMO_WEBHOOK_ENDPOINTS.map((endpoint) => [
        endpoint.id,
        { succeeded: 0, failed: 0, pending: 0, sending: 0 },
      ]),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect((await canvas.findAllByText('No deliveries yet')).length).toBeGreaterThan(0)
    await expect(canvas.queryByText('0%')).not.toBeInTheDocument()
  },
}
