import { type Money, money } from './money'

/**
 * The hosted invoice page's view of one invoice: what the public
 * `GET /public/v1/invoices` answers, reduced to what the page shows.
 */

export type HostedInvoiceState = 'open' | 'processing' | 'paid' | 'voided'

export interface HostedInvoicePayment {
  id: string
  amount: Money
  status: string
  method: string
  at: Date | null
}

export interface HostedInvoiceLine {
  id: string
  name: string
  quantity: string
  amount: Money
}

export interface HostedInvoice {
  tenant: { name: string; contactEmail: string | null }
  number: string
  state: HostedInvoiceState
  currency: string
  total: Money
  subtotal: Money
  discount: Money | null
  tax: Money | null
  amountPaid: Money
  amountRemaining: Money
  dueAt: Date | null
  paidAt: Date | null
  paidWith: string | null
  customerName: string | null
  memo: string | null
  lines: HostedInvoiceLine[]
  payments: HostedInvoicePayment[]
  payEnabled: boolean
}

const PAID = new Set(['SUCCEEDED', 'OVERPAID', 'REFUNDED', 'PARTIALLY_REFUNDED'])

/** Which card the page shows. A voided invoice is voided whatever its payments say. */
export function hostedInvoiceState(invoiceStatus: string, paymentStatus: string): HostedInvoiceState {
  if (invoiceStatus === 'VOIDED') return 'voided'
  if (PAID.has(paymentStatus)) return 'paid'
  if (paymentStatus === 'PROCESSING') return 'processing'
  return 'open'
}

/** A payment link paid through a gateway reads as the gateway; any other method in words. */
export function paymentMethodLabel(methodType: string, gateway: string | null): string {
  if (methodType === 'PAYMENT_LINK' && gateway) return words(gateway)
  return words(methodType || gateway || '')
}

export function toHostedInvoice(wire: unknown): HostedInvoice {
  const body = record(wire)
  const tenant = record(body['tenant'])
  const billing = record(tenant['billing_details'])
  const invoice = record(body['invoice'])
  const currency = text(invoice['currency']) || 'USD'
  const amount = (value: unknown) => moneyOf(value, currency)
  const optional = (value: unknown) => {
    const m = amount(value)
    return Number(m.amount) === 0 ? null : m
  }

  const payments = list(body['payments']).map((p) => ({
    id: text(p['id']),
    amount: moneyOf(p['amount'], text(p['currency']) || currency),
    status: text(p['payment_status']),
    method: paymentMethodLabel(text(p['payment_method_type']), text(p['payment_gateway']) || null),
    at: date(p['succeeded_at']) ?? date(p['failed_at']) ?? date(p['created_at']),
    succeededAt: date(p['succeeded_at']),
  }))
  const lastPaid = payments
    .filter((p) => p.status === 'SUCCEEDED' && p.succeededAt)
    .sort((a, b) => (b.succeededAt?.getTime() ?? 0) - (a.succeededAt?.getTime() ?? 0))[0]

  return {
    tenant: {
      name: text(tenant['name']),
      contactEmail: text(billing['help_email']) || text(billing['email']) || null,
    },
    number: text(invoice['invoice_number']) || text(invoice['id']),
    state: hostedInvoiceState(text(invoice['invoice_status']), text(invoice['payment_status'])),
    currency,
    total: amount(invoice['total']),
    subtotal: amount(invoice['subtotal']),
    discount: optional(invoice['total_discount']),
    tax: optional(invoice['total_tax']),
    amountPaid: amount(invoice['amount_paid']),
    amountRemaining: amount(invoice['amount_remaining']),
    dueAt: date(invoice['due_date']),
    paidAt: date(invoice['paid_at']) ?? lastPaid?.succeededAt ?? null,
    paidWith: lastPaid?.method ?? null,
    customerName: text(record(invoice['customer'])['name']) || null,
    memo: text(invoice['description']) || null,
    lines: list(invoice['line_items']).map((line) => ({
      id: text(line['id']),
      name: text(line['display_name']),
      quantity: text(line['quantity']),
      amount: amount(line['amount']),
    })),
    payments: payments.map(({ succeededAt: _, ...p }) => p),
    payEnabled: record(body['pay'])['enabled'] === true,
  }
}

/** The gateway checkout URL in a pay response, if it carries one. */
export function toPaymentActionUrl(wire: unknown): string | null {
  return text(record(record(wire)['payment_action'])['url']) || null
}

/** The PDF URL in a download response. */
export function toPresignedUrl(wire: unknown): string | null {
  return text(record(wire)['presigned_url']) || null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function date(value: unknown): Date | null {
  const raw = text(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function moneyOf(value: unknown, currency: string): Money {
  try {
    return money(text(value) || '0', currency)
  } catch {
    return money('0', currency)
  }
}

function words(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
