import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { HostedInvoiceView } from './HostedInvoiceView'
import {
  DEMO_HOSTED_INVOICE,
  DEMO_PAID_HOSTED_INVOICE,
  DEMO_VOIDED_HOSTED_INVOICE,
  SPARSE_HOSTED_INVOICE,
} from './fixtures'

/** Before the due date (Oct 26), so the sample reads as Due. */
const BEFORE_DUE = new Date('2026-10-20T12:00:00Z')
const AFTER_DUE = new Date('2026-10-30T12:00:00Z')

const meta = {
  title: 'App/Billing/Hosted invoice/Page',
  component: HostedInvoiceView,
  parameters: { layout: 'fullscreen' },
  args: {
    kind: 'invoice',
    invoice: DEMO_HOSTED_INVOICE,
    now: BEFORE_DUE,
    onPay: fn(),
    isPaying: false,
    payError: null,
    onDownload: fn(),
    isDownloading: false,
    downloadError: null,
    onPreview: fn(),
    preview: null,
    onClosePreview: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof HostedInvoiceView>

export default meta
type Story = StoryObj<typeof meta>

const pay = /^Pay /
type InvoiceArgs = { onPay: () => void; onDownload: () => void; onPreview: () => void }

/** Due: the amount due leads the card, Pay and Download under it, the charges beside it. */
export const Due: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Amount due' })).toBeVisible()
    await expect(canvas.getByText('Due', { selector: '[data-slot=badge]' })).toBeVisible()
    await expect(canvas.getByText('Due Oct 26, 2026')).toBeVisible()
    const card = within(canvas.getByRole('region', { name: 'Amount due' }))
    await expect(card.getByText('Sep 12, 2026 – Oct 11, 2026')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Preview invoice' }))
    await waitFor(() => expect((args as InvoiceArgs).onPreview).toHaveBeenCalledTimes(1))
    await userEvent.click(canvas.getByRole('button', { name: pay }))
    await waitFor(() => expect((args as InvoiceArgs).onPay).toHaveBeenCalledTimes(1))
    await userEvent.click(canvas.getByRole('button', { name: 'Download invoice INV-2026-01488' }))
    await waitFor(() => expect((args as InvoiceArgs).onDownload).toHaveBeenCalledTimes(1))
  },
}

/** Past the due date the card says so, in the destructive tone. */
export const Overdue: Story = {
  args: { now: AFTER_DUE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Overdue', { selector: '[data-slot=badge]' })).toBeVisible()
    await expect(canvas.getByText('Overdue since Oct 26, 2026')).toBeVisible()
    await expect(canvas.getByRole('button', { name: pay })).toBeEnabled()
  },
}

/** Charges grouped by plan and add-on, a struck-through price where something was taken off. */
export const Charges: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'What you’re paying for' })).toBeVisible()
    await expect(canvas.getByText('5 charges')).toBeVisible()
    const growth = canvas.getByRole('region', { name: 'Growth plan' })
    await expect(within(growth).getAllByRole('listitem')).toHaveLength(4)
    await expect(canvas.getByRole('region', { name: 'Priority support' })).toBeVisible()
    // The platform fee's coupon: $179.10 now, $199.00 before.
    const fee = canvas.getByRole('button', { name: /Platform fee/ })
    await expect(fee).toHaveTextContent('$179.10')
    await expect(fee).toHaveTextContent('was $199.00')
    await expect(canvas.getByText('Sales tax (8.25%)')).toBeVisible()
    await expect(canvas.getByText('Prepaid credits')).toBeVisible()
  },
}

/** A row opens into how its amount was reached: quantity, price, what was taken off, the period's total. */
export const ChargeBreakdown: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const fee = canvas.getByRole('button', { name: /Platform fee/ })
    await expect(fee).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(fee)
    await expect(fee).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('Coupon (10% off)')).toBeVisible()
    await expect(canvas.getByText('Total (Oct 12, 2026 – Nov 11, 2026)')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: /AI tokens/ }))
    await expect(canvas.getByText('Included in your plan')).toBeVisible()
    await expect(canvas.getByText('1,000,000')).toBeVisible()
  },
}

/** "All invoice details": both parties' addresses, the memo, and every payment attempt. */
export const Details: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'All invoice details' }))
    const sheet = within(await within(document.body).findByRole('dialog'))
    await expect(sheet.getByText('Invoice details')).toBeVisible()
    await expect(sheet.getByText('548 Market St, Suite 41200')).toBeVisible()
    await expect(sheet.getByText('1200 Harbor Blvd, Floor 3')).toBeVisible()
    await expect(sheet.getByText(/Thank you for building with Vapi/)).toBeVisible()
    // The failed card attempt explains why the balance is still due.
    await expect(sheet.getByText('Card')).toBeVisible()
    await expect(sheet.getByText('Failed')).toBeVisible()
  },
}

/** "Preview invoice" asks the app for the PDF (see Due); the dialog waits for its link. */
export const PreviewLoading: Story = {
  args: { preview: { url: null, error: null } },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'))
    await expect(dialog.getByText('INV-2026-01488.pdf')).toBeVisible()
    await expect(dialog.getByRole('status')).toHaveTextContent('Preparing the PDF…')
  },
}

/** The PDF, with a way to open it outright when a provider refuses to be framed. */
export const PreviewReady: Story = {
  args: { preview: { url: 'about:blank', error: null } },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'))
    await expect(dialog.getByTitle('Invoice INV-2026-01488')).toBeInTheDocument()
    await expect(dialog.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      'about:blank',
    )
    await expect(dialog.getByRole('link', { name: 'Open in a new tab' })).toBeVisible()
  },
}

export const PreviewFailed: Story = {
  args: { preview: { url: null, error: 'Something went wrong, please try again.' } },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'))
    await expect(dialog.getByRole('alert')).toHaveTextContent('Something went wrong')
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
    await expect(canvas.getByRole('heading', { name: 'Payment processing' })).toBeVisible()
    await expect(canvas.getByText('Processing', { selector: '[data-slot=badge]' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: pay })).not.toBeInTheDocument()
  },
}

export const Paid: Story = {
  args: { invoice: DEMO_PAID_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Amount paid' })).toBeVisible()
    await expect(canvas.getByText('Paid', { selector: '[data-slot=badge]' })).toBeVisible()
    await expect(canvas.getByText('Paid Oct 14, 2026 with Stripe')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: pay })).not.toBeInTheDocument()
    await expect(canvas.queryByText('Amount due')).not.toBeInTheDocument()
  },
}

export const Voided: Story = {
  args: { invoice: DEMO_VOIDED_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Voided' })).toBeVisible()
    await expect(canvas.getByText('Void', { selector: '[data-slot=badge]' })).toBeVisible()
    await expect(canvas.getByText('Voided Oct 14, 2026')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: pay })).not.toBeInTheDocument()
  },
}

export const Sparse: Story = {
  args: { invoice: SPARSE_HOSTED_INVOICE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/^Contact /)).not.toBeInTheDocument()
    await expect(canvas.queryByText('Billed to')).not.toBeInTheDocument()
    await expect(canvas.getByText('0 charges')).toBeVisible()
  },
}

export const Invalid: Story = {
  args: { kind: 'invalid', message: 'This link is no longer valid, contact Vapi.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This link is no longer valid, contact Vapi.'),
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

/** A long charge name wraps instead of being cut off, so it reads in full on a phone and on paper. */
export const LongChargeName: Story = {
  args: {
    invoice: {
      ...DEMO_HOSTED_INVOICE,
      groups: [
        {
          ...DEMO_HOSTED_INVOICE.groups[0]!,
          lines: [
            {
              ...DEMO_HOSTED_INVOICE.lines[0]!,
              name: 'Enterprise analytics workspace — premium support and dedicated region add-on',
            },
          ],
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const name = within(canvasElement).getByText(/^Enterprise analytics workspace/)
    await expect(name).toBeVisible()
    await expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth)
  },
}
