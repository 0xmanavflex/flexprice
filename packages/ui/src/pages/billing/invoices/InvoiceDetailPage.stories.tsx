import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { InvoiceStatus, PaymentStatus } from '@fp/domain'
import { AppFailure, LoadingRows, PageBody } from '@ui/compositions'
import { DEMO_INVOICE, type InvoiceDocument } from '@ui/pages/billing/invoices/invoiceDocument'
import { InvoiceDetailView } from '@ui/pages/billing/invoices/InvoiceDetailView'
import { PAGE_STORY_PARAMETERS, PageShell } from '../../shared/shellFixtures'

const ITEMS = ['Platform plan', 'API requests', 'Seats', 'Storage', 'Support add-on']
const METHODS = ['Visa ending 4242', 'ACH debit', 'Mastercard ending 1881']
const PAYMENT_STATUSES = ['Succeeded', 'Failed', 'Pending']
const EVENT_STATUSES = ['completed', 'active', 'pending', 'issue'] as const

interface InvoiceDetailPageProps {
  status: InvoiceStatus
  paymentStatus: PaymentStatus | 'none'
  /** Line items on the invoice; every fifth is a zero line. */
  lineCount: number
  paymentCount: number
  creditNoteCount: number
  eventCount: number
  /** The invoice itself is still loading. */
  isLoading: boolean
  /** The invoice request failed. */
  hasError: boolean
  /** The header's Finalize action is running. */
  isFinalizing: boolean
}

/** Deterministic: every line is a whole-dollar amount derived from its index. */
function makeInvoice(args: InvoiceDetailPageProps): InvoiceDocument {
  const lines = Array.from({ length: args.lineCount }, (_, index) => ({
    id: `line_${index}`,
    description: `${ITEMS[index % ITEMS.length]}${index >= ITEMS.length ? ` ${index + 1}` : ''}`,
    detail: index % 5 === 4 ? 'No usage this period' : 'May 1 – May 31',
    quantity: String(index % 5 === 4 ? 0 : index + 1),
    amount: index % 5 === 4 ? 0 : 100 * (index + 1),
  }))
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  const draft = args.status === InvoiceStatus.Draft
  return {
    ...DEMO_INVOICE,
    id: `inv_${args.status}`,
    number: draft ? null : 'INV-20418',
    status: args.status,
    paymentStatus: args.paymentStatus === 'none' ? null : args.paymentStatus,
    issuedAt: draft ? null : 'May 12, 2026',
    dueAt: draft ? null : 'May 26, 2026',
    lines,
    prepaidCredits: Math.min(100, subtotal),
    paid: args.status === InvoiceStatus.Paid ? subtotal : 0,
    payments: Array.from({ length: args.paymentCount }, (_, index) => ({
      id: `pay_${index + 1}`,
      date: 'May 12, 2026',
      method: METHODS[index % METHODS.length]!,
      amount: 100 + index * 25,
      status: PAYMENT_STATUSES[index % PAYMENT_STATUSES.length]!,
    })),
    creditNotes: Array.from({ length: args.creditNoteCount }, (_, index) => ({
      id: `cn_${index + 1}`,
      number: `CN-${1000 + index}`,
      amount: 25 * (index + 1),
      date: 'May 20, 2026',
    })),
    events: Array.from({ length: args.eventCount }, (_, index) => ({
      id: args.eventCount - index,
      title: `Event ${args.eventCount - index}`,
      at: 'May 12, 2026',
      status: EVENT_STATUSES[index % EVENT_STATUSES.length]!,
      summary: 'Recorded against this invoice.',
    })),
  }
}

/** The invoice route as the console composes it: shell, then the document view or its load and failure states. */
function InvoiceDetailPage(props: InvoiceDetailPageProps) {
  const invoice = makeInvoice(props)

  return (
    <PageShell
      activeItemId="invoices"
      trail={['Billing', 'Invoices', invoice.number ?? 'Draft invoice']}
    >
      {props.isLoading ? (
        <PageBody>
          <div className="pt-4">
            <LoadingRows />
          </div>
        </PageBody>
      ) : props.hasError ? (
        <PageBody>
          <AppFailure
            title="Flexprice had a problem loading this invoice"
            detail="The rest of the console still works. Try again, or go back to the list."
            onRetry={fn()}
          />
        </PageBody>
      ) : (
        <InvoiceDetailView
          invoice={invoice}
          isFinalizing={props.isFinalizing}
          onBack={fn()}
          onEdit={fn()}
          onFinalize={fn()}
          onVoid={fn()}
          onRetryPayment={fn()}
          onDownload={fn()}
          onOpenCustomer={fn()}
          onRecordPayment={fn()}
        />
      )}
    </PageShell>
  )
}

const meta = {
  title: 'Pages/Billing/Invoice detail',
  component: InvoiceDetailPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    status: InvoiceStatus.Open,
    paymentStatus: PaymentStatus.Failed,
    lineCount: 4,
    paymentCount: 1,
    creditNoteCount: 0,
    eventCount: 3,
    isLoading: false,
    hasError: false,
    isFinalizing: false,
  },
  argTypes: {
    status: { control: 'select', options: Object.values(InvoiceStatus) },
    paymentStatus: { control: 'select', options: ['none', ...Object.values(PaymentStatus)] },
    lineCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    paymentCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    creditNoteCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    eventCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    isFinalizing: { control: 'boolean' },
  },
} satisfies Meta<typeof InvoiceDetailPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/invoices/$invoiceId` with every control live: status, line and payment counts, loading and error. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      (await within(canvasElement).findAllByText('Payment failed')).length,
    ).toBeGreaterThan(0)
  },
}

/** `/invoices/$invoiceId` for a paid invoice. */
export const Paid: Story = {
  args: { status: InvoiceStatus.Paid, paymentStatus: PaymentStatus.Succeeded },
}

/** `/invoices/$invoiceId` for a draft, before it has a number or is issued. */
export const Draft: Story = {
  args: { status: InvoiceStatus.Draft, paymentStatus: 'none', paymentCount: 0 },
}

/** `/invoices/$invoiceId` with the Payments tab opened from the tab strip. */
export const PaymentsTab: Story = {
  args: { paymentCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('tab', { name: /Payments/ }))
    await expect((await canvas.findAllByText('Visa ending 4242')).length).toBeGreaterThan(0)
  },
}

/** `/invoices/$invoiceId` while the invoice is loading. */
export const Loading: Story = {
  args: { isLoading: true },
}

/** `/invoices/$invoiceId` when the invoice request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toBeVisible()
  },
}
