import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CheckoutReturnView } from './CheckoutReturnView'
import { PLAN } from './fixtures'

const meta = {
  title: 'App/Self-billing/Checkout return',
  component: CheckoutReturnView,
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    outcome: 'processing',
    billingEmail: 'billing@acme.io',
    paidInvoice: {
      number: 'FP-0001',
      pdfUrl: 'https://example.com/fp-0001.pdf',
      total: 199,
      currency: 'USD',
    },
    plan: PLAN,
    nextInvoiceOn: '2026-11-20',
    onBilling: fn(),
    onUpgrade: fn(),
    onCheckAgain: fn(),
    onOpenProduction: fn(),
    onNextStep: fn(),
  },
} satisfies Meta<typeof CheckoutReturnView>

export default meta
type Story = StoryObj<typeof meta>

export const Confirming: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Confirming your payment' })).toBeVisible()
    await expect(
      canvas.getByText(
        'Stripe is confirming your payment of $199.00. This usually takes a few seconds; keep this page open.',
      ),
    ).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}

export const Success: Story = {
  args: { outcome: 'success' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: "You're live" })).toBeVisible()
    await expect(canvas.getAllByRole('button')[0]).toHaveAccessibleName('Open production')
    await expect(canvas.getByText('Receipt sent to')).toBeVisible()
    await expect(
      canvas.getByText('$199.00 a month + 0.5% of what you bill through Flexprice'),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Create a production API key/ }))
    await expect(args.onNextStep).toHaveBeenCalledWith('api-key')
  },
}

export const Failed: Story = {
  args: { outcome: 'failed' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: "Your payment didn't go through" }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onUpgrade).toHaveBeenCalled()
  },
}

export const Canceled: Story = {
  args: { outcome: 'canceled' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'You left checkout before paying' }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Back to checkout' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Usage & billing' })).toBeVisible()
  },
}

export const StillConfirming: Story = {
  args: { outcome: 'slow' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(
        "Your bank is taking longer than usual. You can keep working; we'll email billing@acme.io when it's done.",
      ),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Check again' }))
    await expect(args.onCheckAgain).toHaveBeenCalled()
  },
}
