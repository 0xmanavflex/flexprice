import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { WebhookMessageSheet } from './WebhookMessageSheet'
import { DEMO_WEBHOOK_ATTEMPTS, DEMO_WEBHOOK_MESSAGES } from './webhookFixtures'

const meta = {
  title: 'App/Developers/Webhooks/Message sheet',
  component: WebhookMessageSheet,
  parameters: { layout: 'fullscreen' },
  args: {
    message: DEMO_WEBHOOK_MESSAGES[1]!,
    attempts: DEMO_WEBHOOK_ATTEMPTS,
    onClose: fn(),
    onResend: fn(async () => undefined),
    locale: 'en-US',
  },
} satisfies Meta<typeof WebhookMessageSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args }) => {
    // The sheet portals out of the canvas.
    const body = within(document.body)
    await expect(await body.findByText('Delivery attempts')).toBeInTheDocument()
    await expect(body.getByText('500')).toBeInTheDocument()
    await expect(body.getByText('No response')).toBeInTheDocument()
    await userEvent.click(body.getAllByRole('button', { name: 'Resend' })[0]!)
    await waitFor(() => expect(args.onResend).toHaveBeenCalled())
  },
}

export const LoadingAttempts: Story = { args: { attempts: [], attemptsLoading: true } }

export const NoAttempts: Story = { args: { attempts: [] } }

export const Closed: Story = { args: { message: null } }

/** Opened from a link before the message arrives: the sheet shows at once, loading. */
export const LoadingMessage: Story = {
  args: { message: null, open: true, messageLoading: true, attempts: [] },
  play: async () => {
    await expect(await screen.findByText('Loading the message…')).toBeVisible()
  },
}

/** The message could not be read: the reason, and Try again. */
export const MessageFailed: Story = {
  args: {
    message: null,
    open: true,
    messageError: 'The message was not found.',
    onRetry: fn(),
    attempts: [],
  },
  play: async ({ args }) => {
    await expect(await screen.findByText('The message was not found.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}
