import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { InvoiceStatus, PaymentStatus } from '@fp/domain'
import type { SubTabQuery } from '../../../compositions/detail/SubTabState'
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
  /** The invoice has a `hosted_invoice_url`: Open and Copy hosted invoice link are live. */
  hasHostedLink?: boolean
  /** `total_discount`: coupons and discounts taken off the subtotal. */
  discount?: number
  paymentsState: SubTabMode
  creditNotesState: SubTabMode
}

type SubTabMode = 'loaded' | 'loading' | 'error'

/** A sub-query in one of the three states a tab can be in besides "has rows". */
function subTab(mode: SubTabMode, onRetry: () => void): SubTabQuery {
  return mode === 'loading'
    ? { isLoading: true }
    : mode === 'error'
      ? {
          isLoading: false,
          error: 'Flexprice had a problem loading this.',
          errorKind: 'server',
          onRetry,
        }
      : { isLoading: false }
}

type PlaygroundArgs = Omit<InvoiceDetailViewProps, 'invoice'> &
  InvoiceShape & { onRetrySubTab: () => void }

const HOSTED_URL = 'https://invoice.flexprice.io/us/hit_demo.signature'

/** Every line is a whole-dollar amount, and every fifth is zero so the always-hidden zero lines have something to hide. */
function makeInvoice(
  args: Omit<InvoiceShape, 'paymentsState' | 'creditNotesState'>,
): InvoiceDocument {
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
    hostedUrl: args.hasHostedLink ? HOSTED_URL : null,
    lines,
    prepaidCredits: Math.min(100, subtotal),
    ...(args.discount ? { discount: args.discount } : {}),
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
  hasHostedLink = false,
  discount,
  paymentsState,
  creditNotesState,
  onRetrySubTab,
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
    hasHostedLink,
    ...(discount ? { discount } : {}),
  })
  return (
    <InvoiceDetailView
      invoice={invoice}
      payments={subTab(paymentsState, onRetrySubTab)}
      creditNotes={subTab(creditNotesState, onRetrySubTab)}
      {...handlers}
    />
  )
}

/** One invoice: Invoice details (document plus Activity, Metadata, Related rail), Payments and Credit memos tabs. */
const meta = {
  title: 'App/Billing/Invoices/Invoice detail view',
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
    paymentsState: 'loaded',
    creditNotesState: 'loaded',
    pendingAction: null,
    onRetrySubTab: fn(),
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
    paymentsState: { control: 'inline-radio', options: ['loaded', 'loading', 'error'] },
    creditNotesState: { control: 'inline-radio', options: ['loaded', 'loading', 'error'] },
    pendingAction: {
      control: 'select',
      options: [null, 'finalize', 'recalculate', 'send', 'retry-payment'],
    },
    onRetrySubTab: { control: false },
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

/** Plain "Invoice" title; an open invoice whose last payment failed, with status pills, ID chip and the More menu on the right. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Invoice' })).toBeVisible()
    // The chips sit in the header, not beside the name and not in a subtitle.
    const header = within(canvas.getByRole('banner'))
    await expect(header.getByText('Finalized')).toBeVisible()
    await expect(header.getByText('Payment failed')).toBeVisible()
    // The header holds only the chips, the ID and More: no inline action buttons.
    await expect(header.queryByRole('button', { name: 'Download invoice' })).toBeNull()
    await expect(header.queryByRole('button', { name: 'Copy hosted invoice link' })).toBeNull()
    await expect(canvas.getByRole('button', { name: /^Copy ID / })).toHaveTextContent('ID')
    // Stripe wording on the document.
    await expect(canvas.getByText('Date of issue')).toBeVisible()
    await expect(canvas.getByText('Bill from')).toBeVisible()
    await expect(canvas.getByText('Unit price')).toBeVisible()
    // Three tabs, Invoice details first and selected; the rail is on that tab only.
    const tabs = canvas.getAllByRole('tab')
    await expect(tabs).toHaveLength(3)
    await expect(tabs[0]).toHaveTextContent('Invoice details')
    await expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.queryByText('Invoice number')).toBeNull()
    await expect(canvas.getByText('Amount due', { selector: 'p' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Activity' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Metadata' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Related' })).toBeVisible()
  },
}

/** Every action lives in More, Download PDF and Copy link included. */
export const MoreMenu: Story = {
  parameters: menuA11y,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    await expect(
      await screen.findByRole('menuitem', { name: /Record payment/ }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: /Download invoice/ }))
    await expect(args.onDownload).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    await screen.findByRole('menuitem', { name: 'Void invoice' })
    await expect(
      screen.getByRole('menuitem', { name: /Copy hosted invoice link/ }),
    ).toHaveAttribute('aria-disabled', 'true')
    await expect(screen.getByRole('menuitem', { name: /Issue a credit note/ })).toBeInTheDocument()
    await expect(screen.getByRole('menuitem', { name: /Send communication/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Void invoice' }))
    await expect(args.onVoid).toHaveBeenCalledOnce()
  },
}

/** With a hosted link, More copies it (the list's row menu is where it opens); Related links to it. */
export const HostedLink: Story = {
  args: { hasHostedLink: true },
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    await expect(
      await screen.findByRole('menuitem', { name: /Copy hosted invoice link/ }),
    ).not.toHaveAttribute('aria-disabled', 'true')
    await expect(screen.getByRole('menuitem', { name: /Open hosted invoice/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    // The Related card names the page, not the raw URL.
    await expect(canvas.getByRole('link', { name: 'Open hosted invoice' })).toHaveAttribute(
      'href',
      HOSTED_URL,
    )
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
    await expect(await screen.findByRole('menuitem', { name: /Finalizing/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}

export const Open: Story = {
  args: { status: InvoiceStatus.Open, paymentStatus: 'none', paymentCount: 0 },
}

/** Overdue reads as a danger pill beside Finalized. */
export const Overdue: Story = {
  args: { status: InvoiceStatus.Overdue, paymentStatus: PaymentStatus.Pending },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('banner')).getByText('Overdue')).toBeVisible()
  },
}

/** A coupon took $50 off: the discount shows under the subtotal and the total is net of it. */
export const WithDiscount: Story = {
  args: { discount: 50 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Discount')).toBeVisible()
    await expect(canvas.getByText('− $50.00')).toBeVisible()
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
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('banner')).getByText('Paid')).toBeVisible()
    await expect(canvas.getByText('Paid in full.')).toBeInTheDocument()
  },
}

export const Void: Story = {
  args: { status: InvoiceStatus.Void, paymentStatus: 'none', paymentCount: 0 },
}

/** Thirty lines, payments, credit memos and events: the long-list state of every tab. */
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
    await expect(canvas.getByRole('button', { name: 'Record payment' })).toBeVisible()
  },
}

export const CreditNotesTab: Story = {
  args: { creditNoteCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Credit memos/ }))
    await expect(await canvas.findByText('CN-1000')).toBeInTheDocument()
  },
}

export const NoCreditNotes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Credit memos/ }))
    await expect(await canvas.findByText('No credit memos yet')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Issue credit memo' })).toBeVisible()
  },
}

/** Zero-amount lines are always hidden, and there is no Items label or switch. */
export const HidesZeroLines: Story = {
  args: { lineCount: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Support add-on')).toBeNull()
    await expect(canvas.queryByRole('switch')).toBeNull()
    await expect(canvas.queryByText('Items')).toBeNull()
  },
}

/** A draft has no payment note strip. */
export const DraftHasNoNote: Story = {
  args: { status: InvoiceStatus.Draft, paymentStatus: 'none', paymentCount: 0, eventCount: 1 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/Finalizing assigns/)).toBeNull()
  },
}

/** Bill to names the customer without an avatar, and without billing tags. */
export const BillTo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Billing email')).toBeNull()
    await expect(canvas.queryByText('Billing address')).toBeNull()
  },
}

/** Payments still loading: a table-shaped skeleton, and the tab label carries no count. */
export const PaymentsLoading: Story = {
  args: { paymentsState: 'loading', paymentCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Payments' })).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Payments' }))
    await expect(await canvas.findByText('Loading payments')).toBeVisible()
    await expect(canvas.queryByText('No payments yet')).toBeNull()
  },
}

/** A failed payments read is an error with a retry, never "No payments yet" and never a 0. */
export const PaymentsError: Story = {
  args: { paymentsState: 'error', paymentCount: 0, paymentStatus: 'none' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Payments' })).toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Payments' }))
    await expect(await canvas.findByText('Flexprice had a problem loading this.')).toBeVisible()
    await expect(canvas.queryByText('No payments yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /Try again/ }))
    await expect(args.onRetrySubTab).toHaveBeenCalled()
  },
}

export const CreditNotesError: Story = {
  args: { creditNotesState: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'Credit memos' }))
    await expect(await canvas.findByText('Flexprice had a problem loading this.')).toBeVisible()
    await expect(canvas.queryByText('No credit memos yet')).toBeNull()
  },
}

/** At the read's cap the list says it may be cut. */
export const PaymentsTruncated: Story = {
  args: { paymentCount: 100 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Payments/ }))
    await expect(await canvas.findByText(/Showing the latest 100/)).toBeVisible()
  },
}

/** Sending is in flight: the menu item says so and cannot be pressed again. */
export const Sending: Story = {
  args: { pendingAction: 'send' },
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'More actions' }))
    const item = await screen.findByRole('menuitem', { name: /Sending…/ })
    await expect(item).toHaveAttribute('aria-disabled', 'true')
  },
}

export const ProviderInvoiceMapping: Story = {
  args: {
    integrationLinks: [
      {
        id: 'stripe',
        name: 'Stripe',
        providerType: 'stripe',
        mappingId: 'map_invoice',
        providerEntityId: 'in_external',
        createdAt: null,
        updatedAt: null,
      },
    ],
  },
  parameters: menuA11y,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Manage Stripe integration' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /^Stripe integration$/ }))
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('menuitem', { name: 'Copy invoice ID' })).toBeVisible()
    await expect(screen.queryByRole('menuitem', { name: 'Copy customer ID' })).toBeNull()
    await expect(screen.queryByRole('menuitem', { name: 'Unlink Stripe' })).toBeNull()
  },
}

/** A credit memo is visible from the header, and the chip leads to the memos. */
export const CreditMemoCue: Story = {
  args: { creditNoteCount: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chip = await canvas.findByRole('button', { name: /2 credit memos issued/ })
    await expect(chip).toHaveTextContent('2 credit memos')
    await userEvent.click(chip)
    await expect(await canvas.findByText('CN-1000')).toBeVisible()
  },
}
