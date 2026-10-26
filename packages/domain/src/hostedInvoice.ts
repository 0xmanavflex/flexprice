import { isPastDue } from './invoice'
import { type Money, money, perUnit } from './money'

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

/** Something taken off one line: a coupon, a discount, prepaid credits. A positive amount. */
export interface HostedInvoiceAdjustment {
  label: string
  amount: Money
}

export interface HostedInvoiceLine {
  id: string
  name: string
  quantity: string
  /** What the line costs after its adjustments. */
  amount: Money
  /** What it cost before them; equal to `amount` when nothing was taken off. */
  gross: Money
  /** `gross / quantity` for a fixed charge; null for usage, whose price may be tiered. */
  unitPrice: Money | null
  kind: 'fixed' | 'usage'
  /** The plan or add-on the line belongs to; lines are grouped under it. */
  group: string
  periodStart: Date | null
  periodEnd: Date | null
  /** The part of the usage an entitlement covered, when one did. */
  included: string | null
  adjustments: HostedInvoiceAdjustment[]
}

/** Lines under one plan or add-on, with what they come to. */
export interface HostedInvoiceGroup {
  name: string
  total: Money
  lines: HostedInvoiceLine[]
}

/** A tax on the invoice: "Sales tax", "8.25%", and how much. */
export interface HostedInvoiceTax {
  name: string
  rate: string | null
  amount: Money
}

/** Who issued or receives the invoice, as the details panel prints them. */
export interface HostedInvoiceParty {
  name: string
  email: string | null
  /** Street, city line and country, each a line; empty when none is on file. */
  address: string[]
}

export interface HostedInvoice {
  tenant: { name: string; contactEmail: string | null; address: string[] }
  /** The customer as billed, with their address; null when the response has none. */
  customer: HostedInvoiceParty | null
  number: string
  state: HostedInvoiceState
  issuedAt: Date | null
  periodStart: Date | null
  periodEnd: Date | null
  voidedAt: Date | null
  /** Prepaid credits taken off the invoice, when any were. */
  prepaidCredits: Money | null
  taxes: HostedInvoiceTax[]
  /** The lines grouped by plan or add-on, in the order they first appear. */
  groups: HostedInvoiceGroup[]
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
export function hostedInvoiceState(
  invoiceStatus: string,
  paymentStatus: string,
  /** False once nothing is left to pay, as the console reads it (paid by credits, say). */
  hasOutstandingBalance = true,
): HostedInvoiceState {
  if (invoiceStatus === 'VOIDED') return 'voided'
  if (PAID.has(paymentStatus)) return 'paid'
  if (!hasOutstandingBalance && paymentStatus !== 'PROCESSING') return 'paid'
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

  const customerWire = record(invoice['customer'])
  const lines = toLines(invoice, amount)

  return {
    tenant: {
      name: text(tenant['name']),
      contactEmail: text(billing['help_email']) || text(billing['email']) || null,
      address: addressLines(record(billing['address'])),
    },
    customer: text(customerWire['name'])
      ? {
          name: text(customerWire['name']),
          email: text(customerWire['email']) || null,
          address: addressLines(customerWire),
        }
      : null,
    number: text(invoice['invoice_number']) || text(invoice['id']),
    state: hostedInvoiceState(
      text(invoice['invoice_status']),
      text(invoice['payment_status']),
      outstanding(invoice['amount_remaining'], invoice['total']),
    ),
    issuedAt:
      date(invoice['issue_date']) ?? date(invoice['finalized_at']) ?? date(invoice['created_at']),
    periodStart: date(invoice['period_start']),
    periodEnd: date(invoice['period_end']),
    voidedAt: date(invoice['voided_at']),
    prepaidCredits: optional(invoice['total_prepaid_credits_applied']),
    taxes: toTaxes(invoice, amount),
    groups: toGroups(lines, currency),
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
    lines,
    payments: payments.map(({ succeededAt: _, ...p }) => p),
    payEnabled: record(body['pay'])['enabled'] === true,
  }
}

/**
 * Whether an open invoice is past its due date. A calendar date: due on the
 * 26th is overdue from the 27th, in UTC, the day the invoice PDF prints.
 */
export function isOverdue(invoice: Pick<HostedInvoice, 'state' | 'dueAt'>, now: Date): boolean {
  return invoice.state === 'open' && isPastDue(invoice.dueAt, now)
}

/**
 * Whether money is still owed. A missing remaining amount falls back to the
 * total, so an invoice the API did not report on is never called paid.
 */
function outstanding(remaining: unknown, total: unknown): boolean {
  const value =
    typeof remaining === 'string' || typeof remaining === 'number'
      ? String(remaining)
      : String(total ?? '0')
  return /[1-9]/.test(value.replace(/^-/, '')) && !value.startsWith('-')
}

type Amount = (value: unknown) => Money

function toLines(invoice: Record<string, unknown>, amount: Amount): HostedInvoiceLine[] {
  const coupons = list(invoice['coupon_applications'])
  return list(invoice['line_items']).map((line) => {
    const id = text(line['id'])
    const gross = amount(line['amount'])
    const quantity = text(line['quantity'])
    const kind = text(line['price_type']).toUpperCase() === 'USAGE' ? 'usage' : 'fixed'
    const adjustments: HostedInvoiceAdjustment[] = []

    // A coupon on this line names itself; a line discount with no coupon behind it is just a discount.
    const lineCoupons = coupons.filter((c) => text(c['invoice_line_item_id']) === id)
    for (const coupon of lineCoupons) {
      const off = amount(coupon['discounted_amount'])
      if (!isZero(off)) adjustments.push({ label: couponLabel(coupon), amount: off })
    }
    const lineDiscount = amount(line['line_item_discount'])
    if (lineCoupons.length === 0 && !isZero(lineDiscount)) {
      adjustments.push({ label: 'Discount', amount: lineDiscount })
    }
    const invoiceDiscount = amount(line['invoice_level_discount'])
    if (!isZero(invoiceDiscount))
      adjustments.push({ label: 'Invoice discount', amount: invoiceDiscount })
    const credits = amount(line['prepaid_credits_applied'])
    if (!isZero(credits)) adjustments.push({ label: 'Prepaid credits applied', amount: credits })

    const net = sumDecimals([gross.amount, ...adjustments.map((a) => `-${a.amount.amount}`)])
    const included = text(line['adjusted_entitlement_quantity'])
    const plan = text(line['plan_display_name'])
    const name = text(line['display_name']) || text(line['meter_display_name']) || 'Charge'
    return {
      id,
      name,
      quantity,
      amount: { amount: net, currency: gross.currency },
      gross,
      unitPrice: kind === 'fixed' ? perUnit(gross, quantity, 2) : null,
      kind,
      // An add-on's lines carry no plan name: the add-on is its own group.
      group: plan || (text(line['entity_type']).toLowerCase() === 'addon' ? name : 'Other charges'),
      periodStart: date(line['period_start']),
      periodEnd: date(line['period_end']),
      included: included && Number(included) > 0 ? included : null,
      adjustments,
    }
  })
}

function toGroups(lines: HostedInvoiceLine[], currency: string): HostedInvoiceGroup[] {
  const groups = new Map<string, HostedInvoiceLine[]>()
  for (const line of lines) groups.set(line.group, [...(groups.get(line.group) ?? []), line])
  return [...groups.entries()].map(([name, members]) => ({
    name,
    total: { amount: sumDecimals(members.map((m) => m.amount.amount)), currency },
    lines: members,
  }))
}

function toTaxes(invoice: Record<string, unknown>, amount: Amount): HostedInvoiceTax[] {
  const taxes = list(invoice['taxes']).flatMap((tax) => {
    const value = amount(tax['tax_amount'])
    if (isZero(value)) return []
    const rate = record(tax['tax_rate'])
    const percent =
      text(rate['percentage_value']) ||
      (typeof rate['percentage_value'] === 'number' ? String(rate['percentage_value']) : '')
    return [
      {
        name: text(rate['name']) || 'Tax',
        rate: percent ? `${trimZeros(percent)}%` : null,
        amount: value,
      },
    ]
  })
  if (taxes.length > 0) return taxes
  // A total with no breakdown still has to be shown.
  const total = amount(invoice['total_tax'])
  return isZero(total) ? [] : [{ name: 'Tax', rate: null, amount: total }]
}

function couponLabel(coupon: Record<string, unknown>): string {
  const percent =
    text(coupon['discount_percentage']) ||
    (typeof coupon['discount_percentage'] === 'number' ? String(coupon['discount_percentage']) : '')
  return text(coupon['discount_type']).toLowerCase() === 'percentage' &&
    percent &&
    Number(percent) > 0
    ? `Coupon (${trimZeros(percent)}% off)`
    : 'Coupon'
}

/** Street, "City, State Postal", country: the lines an address prints on. */
function addressLines(source: Record<string, unknown>): string[] {
  const cityLine = [
    text(source['address_city']),
    [text(source['address_state']), text(source['address_postal_code'])].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')
  return [
    text(source['address_line1']),
    text(source['address_line2']),
    cityLine,
    text(source['address_country']),
  ].filter(Boolean)
}

function isZero(value: Money): boolean {
  return Number(value.amount) === 0
}

function trimZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

/**
 * Adds decimal strings exactly, negatives included: no float ever holds an
 * amount. Used only to take a line's adjustments off its amount and to total a
 * group, both from figures the backend already computed.
 */
export function sumDecimals(values: readonly string[]): string {
  const clean = values.map((v) => v.trim() || '0')
  const scale = Math.max(0, ...clean.map((v) => (v.split('.')[1] ?? '').length))
  let sum = 0n
  for (const value of clean) {
    const negative = value.startsWith('-')
    const [whole = '0', fraction = ''] = value.replace(/^[-+]/, '').split('.')
    const units = BigInt((whole || '0') + fraction.padEnd(scale, '0'))
    sum += negative ? -units : units
  }
  const negative = sum < 0n
  const digits = (negative ? -sum : sum).toString().padStart(scale + 1, '0')
  const whole = digits.slice(0, digits.length - scale)
  const fraction = scale > 0 ? `.${digits.slice(digits.length - scale)}` : ''
  return `${negative ? '-' : ''}${whole}${fraction}`
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
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
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
