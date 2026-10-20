import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { HostedInvoiceView } from './HostedInvoiceView'
import { DEMO_HOSTED_INVOICE, DEMO_PAID_HOSTED_INVOICE, SPARSE_HOSTED_INVOICE } from './fixtures'

const meta = {
  title: 'App/Billing/Hosted invoice/Page',
  component: HostedInvoiceView,
  parameters: { layout: 'fullscreen' },
  args: {
    kind: 'invoice',
    invoice: DEMO_HOSTED_INVOICE,
    onPay: fn(),
    isPaying: false,
    payError: null,
    onDownload: fn(),
    isDownloading: false,
    downloadError: null,
    locale: 'en-GB',
  },
} satisfies Meta<typeof HostedInvoiceView>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Amount due')).toBeVisible()
    await expect(canvas.getByText('DSADDWUO-0001')).toBeVisible()
    await expect(canvas.getByText('14 Nov 2026')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Pay' }))
    await waitFor(() => expect((args as { onPay: () => void }).onPay).toHaveBeenCalledTimes(1))
  },
}

export const Details: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'View invoice and payment details' }))
    // The drawer portals out of the canvas.
    const body = within(document.body)
    // The drawer animates in; wait until it has.
    await waitFor(() => expect(body.getByText('Due 14 Nov 2026')).toBeVisible())
    await expect(body.getByText('Summary')).toBeVisible()
    await expect(body.getByText('API calls')).toBeVisible()
    await expect(body.getByText('Amount remaining')).toBeVisible()
    await expect(body.getByText('Payment history')).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: 'Close invoice and payment details' }))
    await waitFor(() => expect(body.queryByText('Due 14 Nov 2026')).not.toBeInTheDocument())
  },
}

export const Paying: Story = {
  args: { isPaying: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Pay' })).toBeDisabled()
  },
}

export const PayError: Story = {
  args: { payError: "This invoice can't be paid right now." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      "This invoice can't be paid right now.",
    )
  },
}

export const PayDisabled: Story = {
  args: { invoice: { ...DEMO_HOSTED_INVOICE, payEnabled: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Pay' })).toBeDisabled()
  },
}

export const Processing: Story = {
  args: { invoice: { ...DEMO_HOSTED_INVOICE, state: 'processing' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Payment processing')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Pay' })).not.toBeInTheDocument()
  },
}

export const Paid: Story = {
  args: { invoice: DEMO_PAID_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Invoice paid')).toBeVisible()
    await expect(canvas.getByText('14 Oct 2026')).toBeVisible()
    await expect(canvas.getByText('Stripe')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Pay' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Download invoice' })).toBeVisible()
  },
}

export const Voided: Story = {
  args: { invoice: { ...DEMO_HOSTED_INVOICE, state: 'voided', payEnabled: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Invoice voided')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Pay' })).not.toBeInTheDocument()
  },
}

export const Sparse: Story = {
  args: { invoice: SPARSE_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/Questions\?/)).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'View invoice and payment details' }))
    const body = within(document.body)
    await waitFor(() => expect(body.getByText('Summary')).toBeVisible())
    await expect(body.queryByText('Payment history')).not.toBeInTheDocument()
  },
}

export const Invalid: Story = {
  args: { kind: 'invalid', message: 'This link is no longer valid, contact Paras.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This link is no longer valid, contact Paras.'),
    ).toBeVisible()
  },
}

export const NotFound: Story = {
  args: { kind: 'not-found' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Invoice not found')).toBeVisible()
  },
}

export const Failed: Story = {
  args: { kind: 'failed', onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /try again/i }))
    await waitFor(() => expect((args as { onRetry: () => void }).onRetry).toHaveBeenCalled())
  },
}

export const Loading: Story = { args: { kind: 'loading' } }
