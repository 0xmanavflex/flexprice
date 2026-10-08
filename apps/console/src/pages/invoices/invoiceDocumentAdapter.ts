import {
  CREDIT_NOTE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type CreditNote,
  type InvoiceDetail,
  type Payment,
  type Tenant,
  formatAddress,
} from '@fp/domain'
import type { InvoiceDocument, InvoiceLine } from '@fp/ui/pages'
import { mockInvoiceActivity } from './invoiceActivityMock'

const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null

/** Display-only: the view formats these, and the API's own totals ride along unsummed. */
const num = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * The per-unit price shown beside a line, for display only.
 *
 * The API sends a line's quantity and amount, not its unit price, so this is
 * the amount over the quantity. For tiered or package pricing that is the
 * effective (average) unit price. `null` when there is no quantity to divide by.
 */
function unitPrice(quantity: string, amount: string): number | null {
  const qty = Number(quantity.replace(/,/g, ''))
  if (!Number.isFinite(qty) || qty <= 0) return null
  return num(amount) / qty
}

export interface InvoiceDocumentSources {
  /** The issuing tenant, for "Bill from". Omitted while it loads. */
  tenant?: Tenant | undefined
  payments?: Payment[] | undefined
  creditNotes?: CreditNote[] | undefined
}

/**
 * Maps the invoice read model onto the document the detail view renders.
 *
 * Figures come from the API (`totals`), not from the lines. The issuer comes
 * from the tenant record, payments and credit notes from their own lists
 * filtered to this invoice. The activity log is mock data — see
 * `invoiceActivityMock.ts`.
 */
export function toInvoiceDocument(
  invoice: InvoiceDetail,
  sources: InvoiceDocumentSources = {},
): InvoiceDocument {
  const { tenant, payments = [], creditNotes = [] } = sources
  const supportEmail = tenant ? tenant.helpEmail || tenant.billingEmail : ''

  return {
    id: invoice.id,
    number: invoice.number === invoice.id ? null : invoice.number,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    currency: invoice.currency || 'USD',
    issuedAt: day(invoice.issuedAt),
    dueAt: day(invoice.dueDate),
    billTo: {
      name: invoice.customerName,
      ...(invoice.customerEmail ? { email: invoice.customerEmail } : {}),
      address: formatAddress(invoice.customerAddress),
    },
    ...(tenant
      ? {
          from: {
            name: tenant.name,
            ...(supportEmail ? { email: supportEmail } : {}),
            address: formatAddress(tenant.address),
            // The tenant record carries no logo yet; the view draws an initial tile.
            logoUrl: null,
          },
        }
      : {}),
    lines: invoice.lines.map((line): InvoiceLine => ({
      id: line.id,
      description: line.description,
      ...(line.detail ? { detail: line.detail } : {}),
      quantity: line.quantity,
      unitPrice: unitPrice(line.quantity, line.amount),
      amount: num(line.amount),
      kind: line.priceType,
    })),
    prepaidCredits: num(invoice.prepaidCredits),
    tax: num(invoice.tax),
    paid: num(invoice.amountPaid),
    totals: {
      subtotal: num(invoice.subtotal),
      total: num(invoice.total.amount),
      due: num(invoice.amountRemaining.amount),
    },
    customerId: invoice.customerId,
    subscriptionId: invoice.subscriptionId,
    subscriptionLabel: invoice.subscriptionId ?? '',
    // The API has no hosted invoice page yet, so Copy link stays disabled.
    hostedUrl: null,
    metadata: invoice.metadata,
    payments: payments.map((payment) => ({
      id: payment.id,
      date: day(payment.succeededAt ?? payment.createdAt) ?? '—',
      method:
        PAYMENT_METHOD_LABEL[payment.methodType as keyof typeof PAYMENT_METHOD_LABEL] ??
        payment.methodType,
      amount: num(payment.amount.amount),
      status: PAYMENT_STATUS_LABEL[payment.status],
    })),
    creditNotes: creditNotes.map((note) => ({
      id: note.id,
      number: note.number,
      amount: num(note.amount.amount),
      date: day(note.createdAt) ?? '—',
      status: CREDIT_NOTE_STATUS_LABEL[note.status],
    })),
    events: mockInvoiceActivity(invoice),
  }
}
