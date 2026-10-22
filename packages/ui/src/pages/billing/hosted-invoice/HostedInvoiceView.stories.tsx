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
    await expect(canvas.getByRole('heading', { level: 1, name: 'Invoice' })).toBeVisible()
    await expect(canvas.getByText('Due')).toBeVisible()
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
    const drawer = within(body.getByRole('dialog'))
    await expect(drawer.getByText('Billed to')).toBeVisible()
    await expect(drawer.getByRole('heading', { name: 'Items' })).toBeVisible()
    await expect(drawer.getByText('API calls')).toBeVisible()
    await expect(drawer.getByText('Amount remaining')).toBeVisible()
    await expect(drawer.getByRole('heading', { name: 'Payment history' })).toBeVisible()
    await expect(drawer.getByText('Failed')).toBeVisible()
    await userEvent.click(drawer.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(body.queryByText('Due 14 Nov 2026')).not.toBeInTheDocument())
  },
}

export const Paying: Story = {
  args: { isPaying: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Pay' })).toBeDisabled()
    await expect(canvas.queryByText(/Online payment isn’t available/)).not.toBeInTheDocument()
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
    const pay = within(canvasElement).getByRole('button', { name: 'Pay' })
    await expect(pay).toBeDisabled()
    await expect(pay).toHaveAccessibleDescription(
      `Online payment isn’t available for this invoice. Contact ${DEMO_HOSTED_INVOICE.tenant.name} to pay.`,
    )
  },
}

export const Processing: Story = {
  args: { invoice: { ...DEMO_HOSTED_INVOICE, state: 'processing' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Payment processing')).toBeVisible()
    await expect(canvas.getByText('Processing')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Pay' })).not.toBeInTheDocument()
  },
}

export const Paid: Story = {
  args: { invoice: DEMO_PAID_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Invoice paid')).toBeVisible()
    await expect(canvas.getByText('Paid')).toBeVisible()
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
    await expect(canvas.getByText('Void')).toBeVisible()
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
    await waitFor(() => expect(body.getByText('No line items on this invoice.')).toBeVisible())
    await expect(body.queryByText('Billed to')).not.toBeInTheDocument()
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
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Invoice not found')
    await expect(canvas.getByRole('link', { name: 'Contact Flexprice support' })).toHaveAttribute(
      'href',
      'https://flexprice.io/contact',
    )
  },
}

export const Failed: Story = {
  args: { kind: 'failed', onRetry: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /try again/i }))
    await waitFor(() => expect((args as { onRetry: () => void }).onRetry).toHaveBeenCalled())
  },
}

export const Loading: Story = {
  args: { kind: 'loading' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status', { name: 'Loading invoice' }),
    ).toBeVisible()
  },
}
