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

const pay = /^Pay /

/** Open: the amount due leads the sidebar; the lines and totals sit beside it. */
export const Open: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Amount Due' })).toBeVisible()
    await expect(canvas.getByText('Due', { selector: '[data-slot=badge]' })).toBeVisible()
    await expect(canvas.getByText('DSADDWUO-0001')).toBeVisible()
    await expect(canvas.getByText('due 14 Nov 2026')).toBeVisible()
    await expect(canvas.getByText('FX G5 1791253409')).toBeVisible()
    await expect(canvas.getByText('API calls')).toBeVisible()
    await expect(canvas.getByText('× 4,000')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: pay }))
    await waitFor(() => expect((args as { onPay: () => void }).onPay).toHaveBeenCalledTimes(1))
  },
}

/** Download and Print sit under the receipt, as in receipt-5. */
export const Download: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Download invoice DSADDWUO-0001' }))
    await waitFor(() =>
      expect((args as { onDownload: () => void }).onDownload).toHaveBeenCalledTimes(1),
    )
    await expect(canvas.getByRole('button', { name: 'Print invoice DSADDWUO-0001' })).toBeVisible()
  },
}

/** Many lines: one row each, so 15 lines and the totals still read as one short receipt. */
export const ManyLines: Story = {
  args: {
    invoice: {
      ...DEMO_HOSTED_INVOICE,
      lines: Array.from({ length: 15 }, (_, i) => ({
        id: `li_${i}`,
        name: `Usage line ${i + 1}`,
        quantity: String((i + 1) * 120),
        amount: { amount: String(400 + i * 37), currency: 'INR' },
      })),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('15 items')).toBeVisible()
    await expect(canvas.getByText('Usage line 15')).toBeVisible()
    await expect(canvas.getByText('× 1,800')).toBeVisible()
  },
}

export const Paying: Story = {
  args: { isPaying: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: pay })).toBeDisabled()
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
    const button = within(canvasElement).getByRole('button', { name: pay })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAccessibleDescription(
      `Online payment isn’t available for this invoice. Contact ${DEMO_HOSTED_INVOICE.tenant.name} to pay.`,
    )
  },
}

export const Processing: Story = {
  args: { invoice: { ...DEMO_HOSTED_INVOICE, state: 'processing' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Payment Processing' })).toBeVisible()
    await expect(canvas.getByText('Processing', { exact: true })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: pay })).not.toBeInTheDocument()
  },
}

export const Paid: Story = {
  args: { invoice: DEMO_PAID_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Total Paid' })).toBeVisible()
    await expect(canvas.getByText('Paid', { selector: '[data-slot=badge]' })).toBeVisible()
    await expect(canvas.getByText('on 14 Oct 2026')).toBeVisible()
    await expect(canvas.getByText('Stripe')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: pay })).not.toBeInTheDocument()
  },
}

export const Voided: Story = {
  args: { invoice: { ...DEMO_HOSTED_INVOICE, state: 'voided', payEnabled: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Invoice Voided' })).toBeVisible()
    await expect(canvas.getByText('Void', { exact: true })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: pay })).not.toBeInTheDocument()
  },
}

export const Sparse: Story = {
  args: { invoice: SPARSE_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/Questions\?/)).not.toBeInTheDocument()
    await expect(canvas.queryByText('Billed To')).not.toBeInTheDocument()
    await expect(canvas.getByText('0 items')).toBeVisible()
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
