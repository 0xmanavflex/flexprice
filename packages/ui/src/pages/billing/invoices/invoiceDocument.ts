import { InvoiceStatus, PaymentStatus, type ActivityField } from '@fp/domain'

export interface InvoiceLine {
  id: string
  description: string
  /** The service period ("Oct 1 – Nov 1"), shown in the Interval column. */
  detail?: string
  quantity: string
  /** Per-unit price for display; `null` when it cannot be stated (no quantity). */
  unitPrice?: number | null
  amount: number
  /** Usage (metered) or fixed charge; `null` when the API does not say. */
  kind?: 'usage' | 'fixed' | null
}

export interface InvoiceParty {
  name: string
  email?: string
  /** Display lines, already formatted (street, city/region, country). */
  address: string[]
  /** Square logo; the view draws an initial tile when it is absent. */
  logoUrl?: string | null
}

/** One entry in the invoice's activity log (right rail). */
export interface InvoiceActivity {
  id: number
  title: string
  at: string
  status: 'completed' | 'active' | 'pending' | 'issue'
  summary: string
  /** The record's values, one label per line. */
  fields?: readonly ActivityField[]
  /** A second line, such as the amount paid. */
  detail?: string
  /** The record, drawn in front of the summary. */
  record?: string
  /** The person who acted. Omitted when the system did. */
  by?: string
  /** Page for this entity. */
  href?: string
}

export interface InvoicePaymentRow {
  id: string
  date: string
  method: string
  amount: number
  status: string
}

export interface InvoiceCreditNoteRow {
  id: string
  number: string
  amount: number
  date: string
  status?: string
}

export interface InvoiceDocument {
  id: string
  number: string | null
  status: InvoiceStatus
  paymentStatus: PaymentStatus | null
  currency: string
  issuedAt: string | null
  dueAt: string | null
  billTo: InvoiceParty
  /** The issuing tenant. Absent while it loads or when it cannot be read; the block is then omitted. */
  from?: InvoiceParty
  payment?: { method: string; terms: string }
  /** The API's own figures. When present they replace the sums the view would otherwise compute. */
  totals?: { subtotal: number; total: number; due: number }
  lines: InvoiceLine[]
  prepaidCredits: number
  tax: number
  paid: number
  customerId: string
  /** The subscription (contract) this invoice bills, if any. */
  subscriptionId?: string | null
  subscriptionLabel: string
  /** A customer-facing hosted invoice page. Copy link is disabled until one exists. */
  hostedUrl?: string | null
  metadata?: Readonly<Record<string, string>>
  creditNotes: InvoiceCreditNoteRow[]
  payments: InvoicePaymentRow[]
  events: InvoiceActivity[]
  /** Replaces the empty-rail sentence while the audit trail is loading or failed. */
  activityEmptyText?: string
  /** A change just landed and the new activity row is still being written. */
  activityAwaiting?: boolean
}

export interface StatusChip {
  label: string
  tone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
}

/**
 * The header's status chips: the document state (Draft, Finalized, Void,
 * Skipped), then: for a finalized invoice: what the money did (Paid, Overdue,
 * Payment failed, Partially paid, or Payment pending when nothing has happened
 * yet). Overdue and failed carry the danger tone.
 */
export function statusChips(
  doc: Pick<InvoiceDocument, 'status' | 'paymentStatus' | 'paid'>,
): StatusChip[] {
  if (doc.status === InvoiceStatus.Draft) return [{ label: 'Draft', tone: 'info' }]
  if (doc.status === InvoiceStatus.Void) return [{ label: 'Void', tone: 'neutral' }]
  if (doc.status === InvoiceStatus.Skipped) return [{ label: 'Skipped', tone: 'neutral' }]
  const chips: StatusChip[] = [{ label: 'Finalized', tone: 'neutral' }]
  // A refunded invoice reads as refunded, not paid, though nothing remains due.
  if (doc.status === InvoiceStatus.Paid && doc.paymentStatus === PaymentStatus.Refunded)
    chips.push({ label: 'Refund issued', tone: 'neutral' })
  else if (doc.status === InvoiceStatus.Paid) chips.push({ label: 'Paid', tone: 'success' })
  else if (doc.status === InvoiceStatus.Overdue) chips.push({ label: 'Overdue', tone: 'danger' })
  if (doc.status !== InvoiceStatus.Paid && doc.paymentStatus === PaymentStatus.Failed)
    chips.push({ label: 'Payment failed', tone: 'danger' })
  else if (doc.status !== InvoiceStatus.Paid && doc.paid > 0)
    chips.push({ label: 'Partially paid', tone: 'warning' })
  // A finalized invoice says where its money stands when the API says so,
  // including the ordinary case of a payment still pending. Unknown and
  // reversed states are not dressed up as pending.
  if (chips.length === 1) {
    if (doc.paymentStatus === PaymentStatus.Pending)
      chips.push({ label: 'Payment pending', tone: 'warning' })
    else if (doc.paymentStatus === PaymentStatus.Refunded)
      chips.push({ label: 'Refund issued', tone: 'neutral' })
  }
  return chips
}

export type DisplayStatus = {
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
} | null

/** One status, folded from document status and payment status. A draft has none. */
export function displayStatus(
  doc: Pick<
    InvoiceDocument,
    'status' | 'paymentStatus' | 'paid' | 'lines' | 'tax' | 'prepaidCredits'
  >,
): DisplayStatus {
  if (doc.status === InvoiceStatus.Draft) return null
  if (doc.status === InvoiceStatus.Void) return { label: 'Void', tone: 'neutral' }
  if (doc.status === InvoiceStatus.Paid) return { label: 'Paid', tone: 'success' }
  if (doc.paymentStatus === PaymentStatus.Failed) return { label: 'Payment failed', tone: 'danger' }
  if (doc.status === InvoiceStatus.Overdue) return { label: 'Overdue', tone: 'danger' }
  if (doc.paid > 0) return { label: 'Partially paid', tone: 'warning' }
  return { label: 'Open', tone: 'warning' }
}

export function invoiceTotals(doc: InvoiceDocument) {
  if (doc.totals) return doc.totals
  const subtotal = doc.lines.reduce((sum, line) => sum + line.amount, 0)
  const total = subtotal + doc.tax - doc.prepaidCredits
  return { subtotal, total, due: Math.max(0, total - doc.paid) }
}

export const DEMO_INVOICE: InvoiceDocument = {
  id: 'inv_demo',
  number: 'INV-20418',
  status: InvoiceStatus.Open,
  paymentStatus: PaymentStatus.Failed,
  currency: 'USD',
  issuedAt: 'May 12, 2026',
  dueAt: 'May 26, 2026',
  billTo: {
    name: 'Orchid Ledger Group',
    email: 'billing@orchidledger.com',
    address: ['14 Warren Street, Suite 620', 'New York, NY 10007', 'US'],
  },
  from: {
    name: 'Northwind Systems',
    email: 'support@northwind.example',
    address: ['500 Howard Street', 'San Francisco, CA 94105', 'US'],
  },
  payment: { method: 'Visa ending 4242', terms: 'Net 14' },
  lines: [
    {
      id: 'l1',
      description: 'Scale plan',
      detail: 'May 1 – May 31',
      quantity: '1',
      unitPrice: 750,
      amount: 750,
      kind: 'fixed',
    },
    {
      id: 'l2',
      description: 'API requests',
      detail: 'May 1 – May 31',
      quantity: '1,204,000',
      unitPrice: 0.0001,
      amount: 120.4,
      kind: 'usage',
    },
    {
      id: 'l3',
      description: 'Seats',
      quantity: '12',
      unitPrice: 10,
      amount: 120,
      kind: 'fixed',
    },
    {
      id: 'l4',
      description: 'Storage',
      detail: 'No usage this period',
      quantity: '0',
      unitPrice: null,
      amount: 0,
      kind: 'usage',
    },
  ],
  prepaidCredits: 100,
  tax: 0,
  paid: 0,
  customerId: 'cust_demo',
  subscriptionId: 'subs_demo',
  subscriptionLabel: 'Scale · monthly',
  hostedUrl: null,
  metadata: { region: 'us-east', po_number: 'PO-7781' },
  creditNotes: [],
  payments: [
    { id: 'p1', date: 'May 12, 2026', method: 'Visa ending 4242', amount: 890.4, status: 'Failed' },
  ],
  events: [
    {
      id: 3,
      title: 'Payment failed',
      at: 'May 12, 2026',
      status: 'issue',
      summary: 'Card declined by the issuer.',
    },
    {
      id: 2,
      title: 'Invoice finalized',
      at: 'May 12, 2026',
      status: 'completed',
      summary: 'Invoice sent to billing@orchidledger.com.',
    },
    {
      id: 1,
      title: 'Draft created',
      at: 'May 1, 2026',
      status: 'completed',
      summary: 'Generated at the end of the billing period.',
    },
  ],
}
