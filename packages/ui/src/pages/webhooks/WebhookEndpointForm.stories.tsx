import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { WebhookEndpointForm } from './WebhookEndpointForm'
import { DEMO_WEBHOOK_EVENT_TYPES } from './webhookFixtures'

const meta = {
  title: 'Surfaces/Webhooks/WebhookEndpointForm',
  component: WebhookEndpointForm,
  parameters: { layout: 'fullscreen' },
  args: {
    eventTypes: DEMO_WEBHOOK_EVENT_TYPES,
    onSubmit: fn(),
    onCancel: fn(),
    onGeneratePlayUrl: fn(async () => 'https://play.svix.com/in/e_storybook/'),
    trail: [{ label: 'Webhooks', onClick: fn() }, { label: 'Add endpoint' }],
  },
} satisfies Meta<typeof WebhookEndpointForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submitting: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Use a Svix Play test URL' }))
    await waitFor(() =>
      expect(canvas.getByLabelText(/Endpoint URL/)).toHaveValue(
        'https://play.svix.com/in/e_storybook/',
      ),
    )
    await userEvent.click(canvas.getByText('invoice.payment.succeeded'))
    await userEvent.click(canvas.getByRole('button', { name: 'Create endpoint' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({
        url: 'https://play.svix.com/in/e_storybook/',
        description: '',
        filterTypes: ['invoice.payment.succeeded'],
      }),
    )
  },
}

export const InvalidUrl: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText(/Endpoint URL/), 'example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Create endpoint' }))
    await expect(
      await canvas.findByText('Enter a full URL, starting with https://.'),
    ).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitFailed: Story = {
  args: { submitError: 'The webhook service refused the request (422).' },
}
