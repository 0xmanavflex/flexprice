import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { InvoiceStatus, PaymentStatus } from '@fp/domain'
import { DEMO_INVOICE, type InvoiceDocument } from './invoiceDocument'
import { InvoiceDetailView, type InvoiceDetailViewProps } from './InvoiceDetailView'

const ITEMS = ['Platform plan', 'API requests', 'Seats', 'Storage', 'Support add-on']
const METHODS = ['Visa ending 4242', 'ACH debit', 'Mastercard ending 1881']
const PAYMENT_STATUSES = ['Succeeded', 'Failed', 'Pending']
const EVENT_STATUSES = ['completed', 'active', 'pending', 'issue'] as const

/** The menu is portalled; Base UI's focus guards trip this rule (see AppShell.stories.tsx). */
const menuA11y = { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } }

interface InvoiceShape {
  status: InvoiceStatus
  paymentStatus: PaymentStatus | 'none'
  lineCount: number
  paidAmount: number
  paymentCount: number
  creditNoteCount: number
  eventCount: number
  hasIssuer: boolean
  hasSubscription: boolean
  hasNumber: boolean
}

type PlaygroundArgs = Omit<InvoiceDetailViewProps, 'invoice'> & InvoiceShape

/** Every line is a whole-dollar amount, and every fifth is zero so "show zero" has something to reveal. */
function makeInvoice(args: InvoiceShape): InvoiceDocument {
  const lines = Array.from({ length: args.lineCount }, (_, index) => {
    const zero = index % 5 === 4
    return {
      id: `line_${index}`,
      description: `${ITEMS[index % ITEMS.length]}${index >= ITEMS.length ? ` ${index + 1}` : ''}`,
      detail: zero ? 'No usage this period' : 'May 1 – May 31',
      quantity: String(zero ? 0 : index + 1),
      unitPrice: zero ? null : 100,
      amount: zero ? 0 : 100 * (index + 1),
      kind: index % 2 === 0 ? ('fixed' as const) : ('usage' as const),
    }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  const { from, payment, ...base } = DEMO_INVOICE
  return {
    ...base,
    ...(args.hasIssuer && from ? { from } : {}),
    ...(args.hasIssuer && payment ? { payment } : {}),
    id: `inv_${args.status}`,
    number: args.hasNumber && args.status !== InvoiceStatus.Draft ? 'INV-20418' : null,
    status: args.status,
    paymentStatus: args.paymentStatus === 'none' ? null : args.paymentStatus,
    issuedAt: args.status === InvoiceStatus.Draft ? null : 'May 12, 2026',
    dueAt: args.status === InvoiceStatus.Draft ? null : 'May 26, 2026',
    subscriptionId: args.hasSubscription ? 'subs_demo' : null,
    subscriptionLabel: args.hasSubscription ? 'Scale · monthly' : '',
    lines,
    prepaidCredits: Math.min(100, subtotal),
    paid: args.paidAmount,
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

function InvoiceDetailPlayground({
  status,
  paymentStatus,
  lineCount,
  paidAmount,
  paymentCount,
  creditNoteCount,
  eventCount,
  hasIssuer,
  hasSubscription,
  hasNumber,
  ...handlers
}: PlaygroundArgs) {
  const invoice = makeInvoice({
    status,
    paymentStatus,
    lineCount,
    paidAmount,
    paymentCount,
    creditNoteCount,
    eventCount,
    hasIssuer,
    hasSubscription,
    hasNumber,
  })
  return <InvoiceDetailView invoice={invoice} {...handlers} />
}

/** One invoice as a document, with Payments and Credit notes tabs and an Activity, Metadata, Related rail. */
const meta = {
  title: 'Surfaces/InvoiceDetailView',
  component: InvoiceDetailPlayground,
  parameters: { layout: 'fullscreen' },
  args: {
    status: InvoiceStatus.Open,
    paymentStatus: PaymentStatus.Failed,
    lineCount: 4,
    paidAmount: 0,
    paymentCount: 1,
    creditNoteCount: 0,
    eventCount: 3,
    hasIssuer: true,
    hasSubscription: true,
    hasNumber: true,
    isFinalizing: false,
    paymentsLoading: false,
    creditNotesLoading: false,
    onBack: fn(),
    onEdit: fn(),
    onFinalize: fn(),
    onVoid: fn(),
    onRetryPayment: fn(),
    onDownload: fn(),
    onOpenCustomer: fn(),
    onOpenSubscription: fn(),
    onOpenPayment: fn(),
    onOpenCreditNote: fn(),
    onRecordPayment: fn(),
    onIssueCreditNote: fn(),
    onSend: fn(),
    onRecalculate: fn(),
  },
  argTypes: {
    status: { control: 'select', options: Object.values(InvoiceStatus) },
    paymentStatus: { control: 'select', options: ['none', ...Object.values(PaymentStatus)] },
    lineCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    paidAmount: { control: { type: 'number', min: 0, max: 10000, step: 50 } },
    paymentCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    creditNoteCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    eventCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    hasIssuer: { control: 'boolean' },
    hasSubscription: { control: 'boolean' },
    hasNumber: { control: 'boolean' },
    isFinalizing: { control: 'boolean' },
    paymentsLoading: { control: 'boolean' },
    creditNotesLoading: { control: 'boolean' },
    onBack: { control: false },
    onEdit: { control: false },
    onFinalize: { control: false },
    onVoid: { control: false },
    onRetryPayment: { control: false },
    onDownload: { control: false },
    onOpenCustomer: { control: false },
    onOpenSubscription: { control: false },
    onOpenPayment: { control: false },
    onOpenCreditNote: { control: false },
    onRecordPayment: { control: false },
    onIssueCreditNote: { control: false },
    onSend: { control: false },
    onRecalculate: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="bg-background flex h-[900px] flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceDetailPlayground>

export default meta
type Story = StoryObj<typeof meta>

/** Status, payment status, and line, payment, credit-note and event counts as controls. */
export const Playground: Story = {}

/** Plain "Invoice" title; an open invoice whose last payment failed, with status chips, ID chip and the two primary actions on the right. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Invoice' })).toBeVisible()
    // The chips sit in the header, not beside the name and not in a subtitle.
    const header = within(canvas.getByRole('banner'))
    await expect(header.getByText('Finalized')).toBeVisible()
    await expect(header.getByText('Payment failed')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
    // No hosted invoice page yet, so Copy link waits.
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: /^Copy ID / })).toHaveTextContent('ID')
    // Stripe wording on the document.
    await expect(canvas.getByText('Date of issue')).toBeVisible()
    await expect(canvas.getByText('Bill from')).toBeVisible()
    await expect(canvas.getByText('Unit price')).toBeVisible()
    // Only two tabs; the rail is Activity, Metadata, Related.
    await expect(canvas.getAllByRole('tab')).toHaveLength(2)
    await expect(canvas.getByRole('heading', { name: 'Activity' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Metadata' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Related' })).toBeVisible()
  },
}

/** Everything but the two primary actions lives in More. */
export const MoreMenu: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    await expect(
      await screen.findByRole('menuitem', { name: /Record payment/ }),
    ).toBeInTheDocument()
    await expect(screen.getByRole('menuitem', { name: /Issue credit note/ })).toBeInTheDocument()
    await expect(screen.getByRole('menuitem', { name: /Send invoice/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Void invoice' }))
    await expect(args.onVoid).toHaveBeenCalledOnce()
  },
}

/** A draft has no number, and Finalize invoice sits in More. */
export const Draft: Story = {
  args: { status: InvoiceStatus.Draft, paymentStatus: 'none', paymentCount: 0, eventCount: 1 },
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('banner')).getByText('Draft')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Finalize invoice/ }))
    await expect(args.onFinalize).toHaveBeenCalled()
  },
}

/** While finalizing, the menu item is disabled. */
export const Finalizing: Story = {
  args: {
    status: InvoiceStatus.Draft,
    paymentStatus: 'none',
    paymentCount: 0,
    isFinalizing: true,
  },
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'More actions' }))
    await expect(await screen.findByRole('menuitem', { name: /Finalize invoice/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}

export const Open: Story = {
  args: { status: InvoiceStatus.Open, paymentStatus: 'none', paymentCount: 0 },
}

/** Overdue reads as a subtle red chip beside Finalized. */
export const Overdue: Story = {
  args: { status: InvoiceStatus.Overdue, paymentStatus: PaymentStatus.Pending },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('banner')).getByText('Overdue')).toBeVisible()
  },
}

export const PartiallyPaid: Story = {
  args: { paymentStatus: 'none', paidAmount: 400, paymentCount: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('banner')).getByText('Partially paid')).toBeVisible()
  },
}

export const Paid: Story = {
  args: {
    status: InvoiceStatus.Paid,
    paymentStatus: PaymentStatus.Succeeded,
    lineCount: 2,
    paidAmount: 200,
    paymentCount: 1,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Paid in full')).toBeInTheDocument()
  },
}

export const Void: Story = {
  args: { status: InvoiceStatus.Void, paymentStatus: 'none', paymentCount: 0 },
}

/** Thirty lines, payments, credit notes and events: the long-list state of every tab. */
export const LongInvoice: Story = {
  args: {
    lineCount: 30,
    paymentCount: 30,
    creditNoteCount: 30,
    eventCount: 30,
  },
}

export const NoLines: Story = {
  args: { lineCount: 0, paymentStatus: 'none', paymentCount: 0, eventCount: 0 },
}

/** Without issuer or subscription the document drops those blocks. */
export const Minimal: Story = {
  args: { hasIssuer: false, hasSubscription: false },
}

export const PaymentsTab: Story = {
  args: { paymentCount: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Payments/ }))
    await expect(await canvas.findByText('pay_1')).toBeInTheDocument()
  },
}

export const NoPayments: Story = {
  args: { paymentCount: 0, paymentStatus: 'none' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Payments/ }))
    await expect(await canvas.findByText('No payments yet')).toBeInTheDocument()
  },
}

export const CreditNotesTab: Story = {
  args: { creditNoteCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Credit notes/ }))
    await expect(await canvas.findByText('CN-1000')).toBeInTheDocument()
  },
}

export const NoCreditNotes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Credit notes/ }))
    await expect(await canvas.findByText('No credit notes yet')).toBeInTheDocument()
  },
}

/** The zero-amount line stays hidden until "show zero" is switched on. */
export const ShowsZeroLines: Story = {
  args: { lineCount: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Support add-on')).toBeNull()
    await userEvent.click(canvas.getByRole('switch', { name: /Show zero amounts/ }))
    await expect(await canvas.findByText('Support add-on')).toBeInTheDocument()
  },
}
