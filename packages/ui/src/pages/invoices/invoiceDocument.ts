import { InvoiceStatus, PaymentStatus } from '@fp/domain'

export interface InvoiceLine {
  id: string
  description: string
  detail?: string
  quantity: string
  /** Per-unit price for display; absent when the quantity is not a plain number. */
  unitPrice?: number
  amount: number
}

export interface InvoiceDocument {
  id: string
  number: string | null
  status: InvoiceStatus
  paymentStatus: PaymentStatus | null
  currency: string
  issuedAt: string | null
  dueAt: string | null
  billTo: { name: string; email: string; address: string }
  /** Absent when the API does not send the issuer or terms; the view then omits the block. */
  from?: { name: string; address: string; email?: string }
  payment?: { method: string; terms: string }
  /** The API's own figures. When present they replace the sums the view would otherwise compute. */
  totals?: { subtotal: number; total: number; due: number }
  lines: InvoiceLine[]
  prepaidCredits: number
  tax: number
  paid: number
  customerId: string
  subscriptionLabel: string
  creditNotes: { id: string; number: string; amount: number; date: string }[]
  payments: { id: string; date: string; method: string; amount: number; status: string }[]
  events: {
    id: number
    title: string
    at: string
    status: 'completed' | 'active' | 'pending' | 'issue'
    summary: string
  }[]
}

export type DisplayStatus = {
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
} | null

/** One status for the header, folded from document status and payment status. A draft has none. */
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
  return { label: 'Open', tone: 'neutral' }
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
    address: '14 Warren Street, Suite 620, New York, NY',
  },
  from: {
    name: 'Northwind Systems',
    address: '500 Howard Street, San Francisco, CA',
    email: 'billing@northwind.example',
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
    },
    {
      id: 'l2',
      description: 'API requests',
      detail: '1,204,000 at $0.0001',
      quantity: '1,204,000',
      unitPrice: 0.0001,
      amount: 120.4,
    },
    {
      id: 'l3',
      description: 'Seats',
      detail: '12 seats',
      quantity: '12',
      unitPrice: 10,
      amount: 120,
    },
    { id: 'l4', description: 'Storage', detail: 'No usage this period', quantity: '0', amount: 0 },
  ],
  prepaidCredits: 100,
  tax: 0,
  paid: 0,
  customerId: 'cust_demo',
  subscriptionLabel: 'Scale · monthly',
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
