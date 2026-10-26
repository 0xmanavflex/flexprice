import type { Money } from './money'

/** How a performance obligation earns: over its service period, as used, or all at once. */
export const RecognitionMethod = {
  StraightLine: 'straight_line',
  AsConsumed: 'as_consumed',
  PointInTime: 'point_in_time',
} as const
export type RecognitionMethod = (typeof RecognitionMethod)[keyof typeof RecognitionMethod]

export const RECOGNITION_METHOD_LABEL: Record<RecognitionMethod, string> = {
  straight_line: 'Straight-line',
  as_consumed: 'As consumed',
  point_in_time: 'Point in time',
}

/** How a straight-line POB splits its amount across months. */
export const AmortizationMethod = {
  PeriodEven: 'period_even',
  PeriodEvenProrated: 'period_even_prorated',
  Daily: 'daily',
} as const
export type AmortizationMethod = (typeof AmortizationMethod)[keyof typeof AmortizationMethod]

/** Named for what the first month gets, e.g. a Jan 15 start: 100 (full) or 54.84 (prorated). */
export const AMORTIZATION_METHOD_LABEL: Record<AmortizationMethod, string> = {
  period_even: 'Full first month',
  period_even_prorated: 'Prorated first month',
  daily: 'Daily',
}

/** The contract revenue recognition keeps for a subscription. */
export interface RevenueContract {
  id: string
  customerId: string
  currency: string
  termStart: Date
  /** Exclusive; null for an open-ended subscription. */
  termEnd: Date | null
  status: string
}

export interface PerformanceObligation {
  id: string
  name: string
  recognitionMethod: RecognitionMethod | null
  amortizationMethod: AmortizationMethod | null
  serviceStart: Date
  /** Exclusive. */
  serviceEnd: Date | null
  status: string
}

/** One month of revenue: `actual` is posted, `pending` earned but not posted, `scheduled` invoiced but not yet earned. */
export interface RevenueMonth {
  /** `YYYY-MM`. */
  period: string
  total: Money
  actual: Money
  pending: Money
  scheduled: Money
  /** Month-end balances; null for a month that has not ended. */
  deferred: Money | null
  unbilled: Money | null
}

export interface RevenueRow {
  pobId: string
  months: RevenueMonth[]
  total: Money
  /** Posted plus pending: earned up to today. */
  earned: Money
  scheduled: Money
}

export interface RevenueWaterfall {
  periods: string[]
  rows: RevenueRow[]
  totals: RevenueMonth[]
  total: Money
}

export interface SubscriptionRevenue {
  contract: RevenueContract
  obligations: PerformanceObligation[]
  waterfall: RevenueWaterfall
}

const MAX_MONTHS = 36

const monthOf = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const addMonths = (period: string, count: number) => {
  const [year = 0, month = 1] = period.split('-').map(Number)
  return monthOf(new Date(Date.UTC(year, month - 1 + count, 1)))
}

/**
 * The months a contract's waterfall covers: from its term start to the month of
 * its last day, or a year past today when open-ended; the latest 36 at most, the report's limit.
 * e.g. [Apr 22 2026, May 1 2027) → 2026-04 … 2027-04.
 */
export function revenuePeriods(
  termStart: Date,
  termEnd: Date | null,
  today = new Date(),
): { start: string; end: string } {
  const start = monthOf(termStart)
  const last = termEnd
    ? monthOf(new Date(termEnd.getTime() - 86_400_000))
    : addMonths(monthOf(today), 12)
  const end = last < start ? start : last
  const earliest = addMonths(end, 1 - MAX_MONTHS)
  return { start: start < earliest ? earliest : start, end }
}

/** The ledger's accounts; each has one normal side (debit for assets, credit for liabilities and revenue). */
export const LEDGER_ACCOUNT_LABEL: Record<string, string> = {
  cash: 'Cash',
  accounts_receivable: 'Accounts receivable',
  unbilled_receivable: 'Unbilled receivable',
  deferred_revenue: 'Deferred revenue',
  customer_credit: 'Customer credit',
  tax_payable: 'Tax payable',
  revenue: 'Revenue',
  contra_revenue: 'Contra revenue',
}

/** What posted an entry, named the way a ledger reads, e.g. `revenue_offset` reclasses unbilled once invoiced. */
export const JOURNAL_EVENT_LABEL: Record<string, string> = {
  invoice_finalized: 'Invoice sent',
  invoice_voided: 'Invoice voided',
  credit_note_finalized: 'Credit note issued',
  credit_note_voided: 'Credit note voided',
  payment_succeeded: 'Payment received',
  payment_reversed: 'Payment reversed',
  refund_succeeded: 'Refund',
  revenue_earned: 'Revenue recognized',
  revenue_offset: 'Invoice offset',
}

/** One line of a journal entry: an amount on one side of one account. */
export interface JournalLine {
  id: string
  account: string
  debit: Money | null
  credit: Money | null
  pobId: string | null
}

/** One balanced journal entry; its lines' debits equal its credits. */
export interface JournalEntry {
  id: string
  date: Date
  eventType: string
  /** What the entry is about: `invoice`, `pob`, `credit_note`, `payment`, `refund`. */
  sourceType: string
  sourceId: string
  /** The entry this one reverses, if any. */
  reversalOf: string | null
  lines: JournalLine[]
}

/** A contract's journal, oldest first, with both sides totalled; equal totals mean every entry balances. */
export interface ContractJournal {
  entries: JournalEntry[]
  lineCount: number
  debits: Money
  credits: Money
}
