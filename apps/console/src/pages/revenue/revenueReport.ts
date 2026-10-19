import { InvoiceStatus, PaymentStatus, type Invoice, type Money, type Payment } from '@fp/domain'
import type {
  AgingBucket,
  CustomerRevenueRow,
  OverdueCustomerRow,
  PayerRow,
  RevenuePoint,
} from '@fp/ui/pages'

/*
 * Shaping for the Revenue report. Pure functions over what the requests
 * returned, so each rule is tested on its own and the page only wires.
 *
 * Money reaches here as the API's decimal strings. Report figures (bucket
 * sums, ARPU, receivables) are chart arithmetic over those strings; every one
 * that is not the server's own number says what it was computed from.
 */

export const DAY_MS = 86_400_000

export type RangeId = '30d' | '90d' | 'month' | 'quarter' | '12m'
export type Grain = 'day' | 'week' | 'month'

export const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: '12m', label: 'Last 12 months' },
]

export const COMPARE_OPTIONS = [
  { id: 'none', label: 'No comparison' },
  { id: 'previous', label: 'vs previous period' },
]

export interface Window {
  start: Date
  end: Date
}

function utcMidnight(date: Date): Date {
  const copy = new Date(date)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

/** The window a range covers, ending now, and what one bar of it is. */
export function rangeWindow(range: RangeId, now: Date = new Date()): Window & { grain: Grain } {
  const end = now
  switch (range) {
    case '30d':
      return { start: utcMidnight(new Date(now.getTime() - 30 * DAY_MS)), end, grain: 'day' }
    case 'month':
      return {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        end,
        grain: 'day',
      }
    case 'quarter': {
      const month = Math.floor(now.getUTCMonth() / 3) * 3
      return { start: new Date(Date.UTC(now.getUTCFullYear(), month, 1)), end, grain: 'week' }
    }
    case '12m':
      return {
        start: new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth() + 1, 1)),
        end,
        grain: 'month',
      }
    case '90d':
    default:
      return { start: utcMidnight(new Date(now.getTime() - 90 * DAY_MS)), end, grain: 'week' }
  }
}

/** The window of the same length immediately before. */
export function previousWindow(window: Window): Window {
  const length = window.end.getTime() - window.start.getTime()
  return { start: new Date(window.start.getTime() - length), end: new Date(window.start.getTime()) }
}

/** A decimal string or number as a number; anything unreadable is 0. */
export function amountOf(value: Money | string | number | null | undefined): number {
  if (value == null) return 0
  const raw = typeof value === 'object' ? value.amount : value
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatAmount(value: number, currency: string, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${Math.round(value)} ${currency}`
  }
}

export function formatCompactAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return `${Math.round(value)} ${currency}`
  }
}

/** Change from `before` to `now` as a fraction, or null when there is nothing to compare with. */
export function change(now: number, before: number): number | null {
  return before > 0 ? now / before - 1 : null
}

export function percentOf(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'
}

/* ---- Revenue over time ----------------------------------------------------- */

const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** The key and label of the bucket a day falls in. */
function bucketOf(day: Date, grain: Grain, start: Date): { key: string; label: string } {
  if (grain === 'month') {
    const first = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))
    return { key: first.toISOString().slice(0, 7), label: monthLabel.format(first) }
  }
  if (grain === 'week') {
    const index = Math.floor(
      (utcMidnight(day).getTime() - utcMidnight(start).getTime()) / (7 * DAY_MS),
    )
    const first = new Date(utcMidnight(start).getTime() + index * 7 * DAY_MS)
    return { key: `w${String(index).padStart(3, '0')}`, label: dayLabel.format(first) }
  }
  return { key: day.toISOString().slice(0, 10), label: dayLabel.format(day) }
}

/** Every bucket in the window, empty or not, so a quiet week is a zero bar rather than a gap. */
function emptyBuckets(window: Window, grain: Grain): Map<string, { label: string; value: number }> {
  const buckets = new Map<string, { label: string; value: number }>()
  for (let t = utcMidnight(window.start).getTime(); t < window.end.getTime(); t += DAY_MS) {
    const { key, label } = bucketOf(new Date(t), grain, window.start)
    if (!buckets.has(key)) buckets.set(key, { label, value: 0 })
  }
  return buckets
}

export interface RevenueDayRow {
  day: string
  currency: string
  amount: number
}

function bucketed(days: RevenueDayRow[], currency: string, window: Window, grain: Grain) {
  const buckets = emptyBuckets(window, grain)
  for (const row of days) {
    if (row.currency !== currency) continue
    const day = new Date(`${row.day}T00:00:00Z`)
    if (day < utcMidnight(window.start) || day >= window.end) continue
    const { key, label } = bucketOf(day, grain, window.start)
    const bucket = buckets.get(key) ?? { label, value: 0 }
    bucket.value += row.amount
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
}

/**
 * Net revenue per bucket for one currency, with the previous window's buckets
 * laid over by position — the first week against the first week before it.
 */
export function revenueSeries(
  days: RevenueDayRow[],
  currency: string,
  window: Window,
  grain: Grain,
  previous?: { days: RevenueDayRow[]; window: Window },
): RevenuePoint[] {
  const current = bucketed(days, currency, window, grain)
  const before = previous ? bucketed(previous.days, currency, previous.window, grain) : []
  return current.map((bucket, index) => ({
    label: bucket.label,
    revenue: Math.round(bucket.value * 100) / 100,
    ...(previous ? { previous: Math.round((before[index]?.value ?? 0) * 100) / 100 } : {}),
  }))
}

/* ---- Customers ------------------------------------------------------------- */

export interface RevenueCustomerInput {
  customerId: string
  name: string
  total: Money
  usage: Money
  fixed: Money
}

export function customerRows(
  customers: RevenueCustomerInput[],
  currency: string,
): CustomerRevenueRow[] {
  const rows = customers.filter((row) => row.total.currency.toUpperCase() === currency)
  const total = rows.reduce((sum, row) => sum + amountOf(row.total), 0)
  return rows
    .map((row) => {
      const revenue = amountOf(row.total)
      const usage = amountOf(row.usage)
      const contract = amountOf(row.fixed)
      return {
        id: row.customerId,
        name: row.name,
        revenue,
        usage,
        contract,
        display: {
          revenue: formatAmount(revenue, currency),
          usage: formatAmount(usage, currency),
          contract: formatAmount(contract, currency),
        },
        share: total > 0 ? revenue / total : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

/* ---- Receivables ----------------------------------------------------------- */

const AGING: { id: string; label: string; tone: AgingBucket['tone']; from: number; to: number }[] =
  [
    { id: 'd30', label: '1–30 days', tone: 'warning', from: 1, to: 30 },
    { id: 'd60', label: '31–60 days', tone: 'warning', from: 31, to: 60 },
    { id: 'd90', label: '61–90 days', tone: 'critical', from: 61, to: 90 },
    { id: 'd90p', label: '90+ days', tone: 'critical', from: 91, to: Number.POSITIVE_INFINITY },
  ]

export interface Receivables {
  outstanding: number
  overdue: number
  notYetDue: number
  noDueDate: number
  buckets: AgingBucket[]
  customers: OverdueCustomerRow[]
}

/**
 * Unpaid balance on finalized invoices in one currency, by days past due, as
 * of `now`. Drafts and voided invoices owe nothing yet or any more.
 */
export function receivables(
  invoices: Invoice[],
  currency: string,
  now: Date = new Date(),
): Receivables {
  const unpaid = invoices.filter(
    (invoice) =>
      (invoice.status === InvoiceStatus.Open || invoice.status === InvoiceStatus.Overdue) &&
      invoice.amountRemaining.currency.toUpperCase() === currency &&
      amountOf(invoice.amountRemaining) > 0,
  )
  const today = utcMidnight(now).getTime()
  const amounts = new Map<string, number>(AGING.map((bucket) => [bucket.id, 0]))
  let notYetDue = 0
  let noDueDate = 0
  const byCustomer = new Map<string, OverdueCustomerRow & { outstandingValue: number }>()

  for (const invoice of unpaid) {
    const remaining = amountOf(invoice.amountRemaining)
    const entry = byCustomer.get(invoice.customerId) ?? {
      id: invoice.customerId,
      name: invoice.customerName || invoice.customerId,
      invoices: 0,
      overdue: 0,
      display: { overdue: '', outstanding: '' },
      oldestDays: 0,
      outstandingValue: 0,
    }
    entry.outstandingValue += remaining
    if (!invoice.dueDate) {
      noDueDate += remaining
    } else {
      const days = Math.floor((today - utcMidnight(invoice.dueDate).getTime()) / DAY_MS)
      if (days <= 0) notYetDue += remaining
      else {
        const bucket = AGING.find((candidate) => days >= candidate.from && days <= candidate.to)
        if (bucket) amounts.set(bucket.id, (amounts.get(bucket.id) ?? 0) + remaining)
        entry.invoices += 1
        entry.overdue += remaining
        entry.oldestDays = Math.max(entry.oldestDays, days)
      }
    }
    byCustomer.set(invoice.customerId, entry)
  }

  const overdue = [...amounts.values()].reduce((sum, value) => sum + value, 0)
  const outstanding = overdue + notYetDue + noDueDate
  const bucket = (
    id: string,
    label: string,
    tone: AgingBucket['tone'],
    amount: number,
  ): AgingBucket => ({
    id,
    label,
    tone,
    amount,
    display: formatCompactAmount(amount, currency),
  })

  return {
    outstanding,
    overdue,
    notYetDue,
    noDueDate,
    buckets: [
      bucket('current', 'Not yet due', 'neutral', notYetDue),
      ...AGING.map((aging) =>
        bucket(aging.id, aging.label, aging.tone, amounts.get(aging.id) ?? 0),
      ),
    ],
    customers: [...byCustomer.values()]
      .filter((row) => row.overdue > 0)
      .sort((a, b) => b.overdue - a.overdue)
      .map(({ outstandingValue, ...row }) => ({
        ...row,
        display: {
          overdue: formatAmount(row.overdue, currency),
          outstanding: formatAmount(outstandingValue, currency),
        },
      })),
  }
}

/* ---- Days to pay ------------------------------------------------------------ */

export interface DaysToPay {
  average: number | null
  median: number | null
  paidCount: number
  withinWeek: number | null
  series: { label: string; days: number }[]
  payers: PayerRow[]
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/**
 * Days from an invoice's issue to the payment that settled it, for succeeded
 * payments in the window whose invoice is among those loaded.
 */
export function daysToPay(
  payments: Payment[],
  invoices: Invoice[],
  window: Window,
  grain: Grain,
  currency: string,
): DaysToPay {
  const byNumber = new Map(
    invoices.filter((invoice) => invoice.number).map((invoice) => [invoice.number, invoice]),
  )
  const settled: { days: number; at: Date; invoice: Invoice; amount: number }[] = []
  for (const payment of payments) {
    if (payment.status !== PaymentStatus.Succeeded || !payment.succeededAt) continue
    if (payment.succeededAt < window.start || payment.succeededAt >= window.end) continue
    const invoice = byNumber.get(payment.invoiceNumber)
    if (!invoice?.issuedAt) continue
    if (payment.amount.currency.toUpperCase() !== currency) continue
    const days = Math.max(
      0,
      Math.round((payment.succeededAt.getTime() - invoice.issuedAt.getTime()) / DAY_MS),
    )
    settled.push({ days, at: payment.succeededAt, invoice, amount: amountOf(payment.amount) })
  }

  const days = settled.map((row) => row.days)
  const buckets = new Map<string, { label: string; total: number; count: number }>()
  for (const [key, value] of emptyBuckets(window, grain))
    buckets.set(key, { label: value.label, total: 0, count: 0 })
  for (const row of settled) {
    const { key, label } = bucketOf(row.at, grain, window.start)
    const bucket = buckets.get(key) ?? { label, total: 0, count: 0 }
    bucket.total += row.days
    bucket.count += 1
    buckets.set(key, bucket)
  }

  const byCustomer = new Map<
    string,
    { name: string; paid: number; collected: number; days: number }
  >()
  for (const row of settled) {
    const id = row.invoice.customerId
    const entry = byCustomer.get(id) ?? {
      name: row.invoice.customerName || id,
      paid: 0,
      collected: 0,
      days: 0,
    }
    entry.paid += 1
    entry.collected += row.amount
    entry.days += row.days
    byCustomer.set(id, entry)
  }

  return {
    average: days.length
      ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length)
      : null,
    median: median(days),
    paidCount: days.length,
    withinWeek: days.length ? days.filter((value) => value <= 7).length / days.length : null,
    series: [...buckets.values()]
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({ label: bucket.label, days: Math.round(bucket.total / bucket.count) })),
    payers: [...byCustomer.entries()]
      .map(([id, entry]) => ({
        id,
        name: entry.name,
        paid: entry.paid,
        collected: formatAmount(entry.collected, currency),
        averageDays: Math.round(entry.days / entry.paid),
      }))
      .sort((a, b) => b.averageDays - a.averageDays),
  }
}

/* ---- Events ------------------------------------------------------------------ */

const compactCount = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function eventsSummary(points: { timestamp: Date; eventCount: number }[]) {
  const series = points.map((point) => ({
    label: dayLabel.format(point.timestamp),
    events: point.eventCount,
  }))
  const total = series.reduce((sum, point) => sum + point.events, 0)
  const peak = series.reduce((max, point) => Math.max(max, point.events), 0)
  return {
    series,
    total: compactCount.format(total),
    average: series.length ? compactCount.format(total / series.length) : '—',
    peak: compactCount.format(peak),
    empty: total === 0,
  }
}
