import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WebhookActivity } from './WebhookActivity'
import { DEMO_WEBHOOK_ACTIVITY } from './webhookFixtures'

const meta = {
  title: 'App/Developers/Webhooks/Activity',
  component: WebhookActivity,
  parameters: { layout: 'padded' },
  args: { points: DEMO_WEBHOOK_ACTIVITY, locale: 'en-US' },
} satisfies Meta<typeof WebhookActivity>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Successful attempts')).toBeInTheDocument()
    await expect(canvas.getByText('301')).toBeInTheDocument()
    await expect(canvas.getByText('13')).toBeInTheDocument()
  },
}

export const NoActivity: Story = { args: { points: [] } }

export const Loading: Story = { args: { points: [], isLoading: true } }

/** A failed read is an error with a retry, not an empty chart. */
export const Failed: Story = {
  args: {
    points: [],
    error: 'We could not reach Flexprice.',
    errorKind: 'network',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Activity could not be loaded')
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}
