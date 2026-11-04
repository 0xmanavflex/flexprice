import {
  BillingModel,
  CREDIT_NOTE_STATUS_LABEL,
  paymentMethodName,
  PAYMENT_STATUS_LABEL,
  type Charge,
  type CreditNote,
  type CustomerDetail,
  type InvoiceDetail,
  type Payment,
  type Tenant,
  formatAddress,
} from '@fp/domain'
import type { ActivityEntry } from '@fp/domain'
import type { InvoiceDocument, InvoiceFormParty, InvoiceLine } from '@fp/ui/pages'
import { railActivity } from '../shared/activityLog'
import { invoiceLifecycle } from './invoiceLifecycle'

const day = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : null

const shortDay = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
const longDay = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date)

/**
 * The line's service period: a compact label for the Interval column ("Oct 1 – Nov 1")
 * and the full dates with years for its tooltip. Falls back to the read model's label.
 */
function linePeriod(
  line: InvoiceDetail['lines'][number],
): Pick<InvoiceLine, 'detail' | 'detailFull'> {
  if (line.periodStart && line.periodEnd) {
    return {
      detail: `${shortDay(line.periodStart)} – ${shortDay(line.periodEnd)}`,
      detailFull: `${longDay(line.periodStart)} – ${longDay(line.periodEnd)}`,
    }
  }
  return line.detail ? { detail: line.detail } : {}
}

/** Display-only: the view formats these, and the API's own totals ride along unsummed. */
const num = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * The per-unit price shown beside a line, for display only.
 *
 * An invoice line carries its quantity and its (rounded) amount, not the rate
 * it was billed at, so the rate is read from the line's own price when that is
 * a flat per-unit charge in the invoice's currency. Without one, the amount
 * over the quantity is shown only when it multiplies back to the amount
 * exactly: 7.04 over 3 is not the 2.3456 rate that produced it, and printing
 * 2.346667 would state a price nobody set. `null` (a dash) otherwise.
 */
function unitPrice(
  line: InvoiceDetail['lines'][number],
  currency: string,
  charge: Charge | undefined,
): number | null {
  if (charge) {
    const flat =
      charge.billingModel === BillingModel.FlatFee &&
      !charge.priceUnit &&
      !charge.transformQuantity &&
      charge.currency.toLowerCase() === currency.toLowerCase()
    const rate = Number(charge.amount)
    return flat && charge.amount !== '' && Number.isFinite(rate) ? rate : null
  }
  const qty = Number(line.quantity.replace(/,/g, ''))
  if (!Number.isFinite(qty) || qty <= 0) return null
  const amount = num(line.amount)
  const rate = Number((amount / qty).toFixed(6))
  // Compared in hundred-thousandths of a cent, clear of float noise.
  return Math.round(rate * qty * 1e7) === Math.round(amount * 1e7) ? rate : null
}

export interface InvoiceDocumentSources {
  /** The issuing tenant, for "Bill from". Omitted while it loads. */
  tenant?: Tenant | undefined
  /** "Bill from" when a billing entity issues the invoice (`billFromFor`); the tenant otherwise. */
  billFrom?: InvoiceFormParty | null | undefined
  payments?: Payment[] | undefined
  creditNotes?: CreditNote[] | undefined
  /** Audit trail. When set, it replaces the timestamps assembled from the invoice. */
  activity?: ActivityEntry[] | undefined
  activityEmptyText?: string | undefined
  activityAwaiting?: boolean | undefined
  /** `hosted_invoice_url`: the link the customer receives. Null or omitted when there is none. */
  hostedUrl?: string | null | undefined
  /**
   * The invoice's own customer (`customer_id`), for "Bill to". The invoice's
   * expanded customer can be the contract's instead, when another customer is
   * invoiced for it. Omitted while it loads.
   */
  billTo?: CustomerDetail | undefined
  /** The lines' prices by id, for each line's unit rate. Omitted while they load. */
  charges?: ReadonlyMap<string, Charge> | undefined
}

/**
 * Maps the invoice read model onto the document the detail view renders.
 *
 * Figures come from the API (`totals`), not from the lines. The issuer comes
 * from the tenant record, payments and credit memos from their own lists
 * filtered to this invoice. The activity rail lists the invoice's own lifecycle
 * timestamps (`invoiceLifecycle.ts`), not an audit log.
 */
export function toInvoiceDocument(
  invoice: InvoiceDetail,
  sources: InvoiceDocumentSources = {},
): InvoiceDocument {
  const {
    tenant,
    billFrom,
    payments = [],
    creditNotes = [],
    activity,
    activityEmptyText,
    activityAwaiting,
    hostedUrl = null,
    billTo,
    charges,
  } = sources
  const supportEmail = tenant ? tenant.helpEmail || tenant.billingEmail : ''

  return {
    id: invoice.id,
    number: invoice.number.trim() ? invoice.number : null,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    currency: invoice.currency || 'USD',
    issuedAt: day(invoice.issuedAt),
    dueAt: day(invoice.dueDate),
    ...(invoice.description.trim() ? { memo: invoice.description } : {}),
    billTo: billTo
      ? {
          name: billTo.name || billTo.email || billTo.id,
          ...(billTo.email ? { email: billTo.email } : {}),
          address: formatAddress({
            line1: billTo.addressLine1,
            line2: billTo.addressLine2,
            city: billTo.addressCity,
            state: billTo.addressState,
            postalCode: billTo.addressPostalCode,
            country: billTo.addressCountry,
          }),
        }
      : {
          name: invoice.customerName,
          ...(invoice.customerEmail ? { email: invoice.customerEmail } : {}),
          address: formatAddress(invoice.customerAddress),
        },
    ...(billFrom
      ? {
          from: {
            name: billFrom.name,
            ...(billFrom.email ? { email: billFrom.email } : {}),
            address: billFrom.address,
            ...(billFrom.taxIds?.length ? { taxIds: billFrom.taxIds } : {}),
            logoUrl: null,
          },
        }
      : tenant
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
      ...linePeriod(line),
      quantity: line.quantity,
      unitPrice: unitPrice(line, invoice.currency, charges?.get(line.priceId ?? '')),
      amount: num(line.amount),
      kind: line.priceType,
      ...(line.note?.trim() ? { note: line.note } : {}),
    })),
    prepaidCredits: num(invoice.prepaidCredits),
    discount: num(invoice.discount),
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
    // The link the customer receives (Stripe's page, or the Flexprice hosted invoice).
    hostedUrl,
    metadata: invoice.metadata,
    payments: payments.map((payment) => ({
      id: payment.id,
      date: day(payment.succeededAt ?? payment.createdAt) ?? '—',
      method: paymentMethodName(payment.methodType),
      ...(payment.paymentUrl ? { paymentUrl: payment.paymentUrl } : {}),
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
    events: activity ? railActivity(activity) : invoiceLifecycle(invoice),
    ...(activityEmptyText ? { activityEmptyText } : {}),
    ...(activityAwaiting ? { activityAwaiting } : {}),
  }
}
