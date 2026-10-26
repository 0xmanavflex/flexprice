import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  reportBreakdown,
  reportCurrencies,
  reportScalar,
  reportSeries,
  useReport,
  useRevenueOverview,
  type ReportPoint,
  type ReportQuery,
  type ReportScalar,
} from '@fp/query'
import {
  RevenueReport,
  type AgingBucket,
  type CustomerRevenueRow,
  type OverdueCustomerRow,
  type PayerRow,
  type ReportStatus,
} from '@fp/ui/pages'
import { useSession } from '@/app/session'
import type { RevenueSearch } from '@/app/revenueSearch'
import {
  COMPARE_OPTIONS,
  GRAIN_OPTIONS,
  DAY_MS,
  RANGE_OPTIONS,
  amountOf,
  customerRows as dashboardCustomerRows,
  creditRows,
  creditTypeRows,
  alignToWindow,
  formatAmount,
  percentOf,
  rangeWindow,
  resolveGrain,
  type GrainChoice,
  type RangeId,
} from './revenueReport'

/**
 * Reports: the analytics report library, on the console's report components.
 *
 * Every figure comes from `POST /analytics/reports/{key}/query`, one report per
 * panel, on the same range, grain, currency and comparison:
 *
 *   - **Revenue**: `invoice_total`: scalar (headline and totals), timeseries
 *     (the chart) and breakdown by customer (the Customers tab).
 *   - **ARPU**: `arpu`.
 *   - **Receivables**: `total_receivables` (outstanding) and
 *     `receivables_aging` by bucket and by customer.
 *   - **Payments**: `days_to_pay`: scalar, timeseries and breakdown by customer.
 *   - **Usage**: `events_volume` (at most seven days), with `credit_consumption`
 *     and `credit_topups`.
 *
 * The usage and contract split of revenue is the one figure no report gives:
 * it stays on the revenue dashboard (`POST /dashboard/revenue-dashboard`).
 */

/** The widest range the events report answers (its `max_range_days`). */
/** How many customers a breakdown lists. */
const TOP = 50

const AGING: Record<
  string,
  { id: string; label: string; tone: AgingBucket['tone']; days: number }
> = {
  '1-30': { id: 'd30', label: '1–30 days', tone: 'warning', days: 30 },
  '31-60': { id: 'd60', label: '31–60 days', tone: 'warning', days: 60 },
  '61-90': { id: 'd90', label: '61–90 days', tone: 'critical', days: 90 },
  '90+': { id: 'd90p', label: '90+ days', tone: 'critical', days: 91 },
}
const NOT_DUE = 'Current'

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** The status of one report read: loading, failed, nothing to show, or ready. */
const useCardReport = (key: string, query: ReportQuery | null) =>
  useReport(key, query, { handleErrors: true })

const CREDIT_TYPES = { paid: 'Paid credits', free: 'Free credits' }

const TOPUP_SOURCES = {
  PURCHASED_CREDIT_DIRECT: 'Purchased, paid directly',
  PURCHASED_CREDIT_INVOICED: 'Purchased, invoiced',
  PURCHASED_CREDIT_BONUS: 'Purchase bonus',
  FREE_CREDIT_GRANT: 'Free grant',
  SUBSCRIPTION_CREDIT_GRANT: 'Subscription grant',
}

function statusOf(query: { isPending: boolean; isError: boolean; data?: unknown }, empty: boolean) {
  if (query.isPending) return 'loading' as const
  if (query.isError && !query.data) return 'error' as const
  return empty ? ('empty' as const) : ('ready' as const)
}

export function ReportsPage({
  search,
  onSearchChange,
}: {
  search: RevenueSearch
  onSearchChange: (next: RevenueSearch) => void
}) {
  const navigate = useNavigate()
  const { environmentId } = useSession()
  const comparing = search.compare !== 'none'

  // One window per range: a fresh `Date` each render would change every query key.
  const window = useMemo(() => rangeWindow(search.range), [search.range])
  const grain = resolveGrain(search.grain, window.grain)
  const rangeLabel = (
    RANGE_OPTIONS.find((option) => option.id === search.range)?.label ?? 'Last 12 months'
  ).toLowerCase()
  // `from..to`, to exclusive: through the end of today.
  const range = `${isoDay(window.start)}..${isoDay(new Date(window.end.getTime() + DAY_MS))}`
  const compare = comparing ? ('previous_period' as const) : undefined
  const base: Omit<ReportQuery, 'shape'> = { range, ...(compare ? { compare } : {}) }

  // Revenue across every currency first: it says which currencies there are.
  const revenueAll = useCardReport('invoice_total', { ...base, shape: 'scalar' })
  const currencies = reportCurrencies(revenueAll.data)
  const currency =
    (search.currency && currencies.includes(search.currency) ? search.currency : currencies[0]) ??
    'USD'
  const inCurrency = { ...base, currency: currency.toLowerCase() }

  const revenueSeries = useCardReport('invoice_total', {
    ...inCurrency,
    shape: 'timeseries',
    grain,
  })
  const revenueByCustomer = useCardReport('invoice_total', {
    ...inCurrency,
    shape: 'breakdown',
    dimensions: ['customer_id'],
    limit: TOP,
  })
  const creditReport = useCardReport('credit_consumption', {
    range,
    currency: currency.toLowerCase(),
    shape: 'breakdown',
    dimensions: ['customer_id', 'credit_type'],
  })
  const arpuReport = useCardReport('arpu', { ...inCurrency, shape: 'scalar' })
  const receivablesReport = useCardReport('total_receivables', {
    range,
    currency: currency.toLowerCase(),
    shape: 'scalar',
  })
  const agingReport = useCardReport('receivables_aging', {
    range,
    currency: currency.toLowerCase(),
    shape: 'breakdown',
    dimensions: ['aging_bucket'],
  })
  const agingByCustomer = useCardReport('receivables_aging', {
    range,
    currency: currency.toLowerCase(),
    shape: 'breakdown',
    dimensions: ['customer_id', 'aging_bucket'],
  })
  // Days to pay has no daily grain.
  const payGrain = grain === 'day' ? 'week' : grain
  const daysReport = useCardReport('days_to_pay', { ...inCurrency, shape: 'scalar' })
  const daysSeries = useCardReport('days_to_pay', {
    ...inCurrency,
    shape: 'timeseries',
    grain: payGrain,
  })
  const daysByCustomer = useCardReport('days_to_pay', {
    ...inCurrency,
    shape: 'breakdown',
    dimensions: ['customer_id'],
    limit: TOP,
  })
  // `POST /events/analytics` returns no rows without a customer: the tenant
  // path is disabled on the server. `events_volume` is the count that works,
  // and it covers at most seven days.
  const eventsStart = new Date(Math.max(window.start.getTime(), window.end.getTime() - 6 * DAY_MS))
  const eventsLimited = eventsStart.getTime() > window.start.getTime()
  const eventsReport = useCardReport('events_volume', {
    range: `${isoDay(eventsStart)}..${isoDay(new Date(window.end.getTime() + DAY_MS))}`,
    shape: 'timeseries',
    grain: 'day',
  })
  const topupReport = useCardReport('credit_topups', {
    range,
    currency: currency.toLowerCase(),
    shape: 'breakdown',
    dimensions: ['transaction_reason', 'customer_id'],
  })
  // The usage and contract split: no report gives it.
  const overview = useRevenueOverview(environmentId, window)

  const revenue = reportScalar(revenueAll.data, 'invoice_total', currency)
  const arpu = reportScalar(arpuReport.data, 'arpu', currency)
  const outstanding = reportScalar(receivablesReport.data, 'total_receivables', currency).value ?? 0
  const aging = reportBreakdown(agingReport.data, 'receivables_aging', ['aging_bucket'], currency)
  const notYetDue = aging
    .filter((row) => row.keys['aging_bucket'] === NOT_DUE)
    .reduce((sum, row) => sum + row.value, 0)
  const overdue = aging
    .filter((row) => row.keys['aging_bucket'] !== NOT_DUE)
    .reduce((sum, row) => sum + row.value, 0)
  const days = reportScalar(daysReport.data, 'days_to_pay', currency)

  // Customer names for every breakdown, in one lookup.
  const customerRevenue = reportBreakdown(
    revenueByCustomer.data,
    'invoice_total',
    ['customer_id'],
    currency,
  )
  const customerAging = reportBreakdown(
    agingByCustomer.data,
    'receivables_aging',
    ['customer_id', 'aging_bucket'],
    currency,
  )
  const customerDays = reportBreakdown(
    daysByCustomer.data,
    'days_to_pay',
    ['customer_id'],
    currency,
  )
  // Names come from the revenue dashboard, which already returns them with the
  // usage and contract split. Customer search is not called for this page.
  const split = new Map(
    dashboardCustomerRows(overview.data?.customers ?? [], currency).map((row) => [row.id, row]),
  )
  const nameOf = (id: string) => split.get(id)?.name ?? id

  const money = (value: number) => formatAmount(value, currency)
  const moneyOrDash = (value: number | null) => (value === null ? '—' : money(value))
  const figure = (scalar: ReportScalar, format: (value: number | null) => string) => ({
    value: format(scalar.value),
    ...(comparing && scalar.previous !== null ? { detail: `vs ${format(scalar.previous)}` } : {}),
    change: comparing ? scalar.change : null,
  })

  const summary = overview.data?.summaries.find((row) => row.currency.toUpperCase() === currency)
  const usage = amountOf(summary?.usage)
  const contract = amountOf(summary?.fixed)
  const total = revenue.value ?? 0

  const points = alignToWindow(
    reportSeries(revenueSeries.data, 'invoice_total', currency).map((point: ReportPoint) => ({
      at: point.bucket,
      value: point.value,
      previous: point.previous,
    })),
    window,
    grain,
    comparing,
  ).map((point) => ({
    label: point.label,
    revenue: point.value ?? 0,
    ...(point.previous != null ? { previous: point.previous } : {}),
  }))

  const creditBreakdown = reportBreakdown(
    creditReport.data,
    'credit_consumption',
    ['customer_id', 'credit_type'],
    currency,
  )
  const topupBreakdown = reportBreakdown(
    topupReport.data,
    'credit_topups',
    ['transaction_reason', 'customer_id'],
    currency,
  )
  const credits = creditRows(creditBreakdown, nameOf, money)
  const customerRows: CustomerRevenueRow[] = customerRevenue.map((row) => {
    const id = row.keys['customer_id'] ?? ''
    const known = split.get(id)
    return {
      id,
      name: nameOf(id),
      revenue: row.value,
      usage: known?.usage ?? 0,
      contract: known?.contract ?? 0,
      display: {
        revenue: money(row.value),
        usage: known ? money(known.usage) : '—',
        contract: known ? money(known.contract) : '—',
      },
      share: total > 0 ? row.value / total : 0,
    }
  })

  // Aging by customer: overdue is every bucket past due; the oldest bucket is the worst.
  const overdueByCustomer = new Map<
    string,
    { overdue: number; outstanding: number; oldest: number }
  >()
  for (const row of customerAging) {
    const id = row.keys['customer_id'] ?? ''
    const bucket = row.keys['aging_bucket'] ?? ''
    const entry = overdueByCustomer.get(id) ?? { overdue: 0, outstanding: 0, oldest: 0 }
    entry.outstanding += row.value
    const past = AGING[bucket]
    if (past) {
      entry.overdue += row.value
      entry.oldest = Math.max(entry.oldest, past.days)
    }
    overdueByCustomer.set(id, entry)
  }
  const overdueRows: OverdueCustomerRow[] = [...overdueByCustomer.entries()]
    .filter(([, entry]) => entry.overdue > 0)
    .sort((a, b) => b[1].overdue - a[1].overdue)
    .map(([id, entry]) => ({
      id,
      name: nameOf(id),
      overdue: entry.overdue,
      display: { overdue: money(entry.overdue), outstanding: money(entry.outstanding) },
      oldestDays: entry.oldest,
    }))

  const payers: PayerRow[] = customerDays.map((row) => {
    const id = row.keys['customer_id'] ?? ''
    return { id, name: nameOf(id), averageDays: Math.round(row.value) }
  })

  const events = reportSeries(eventsReport.data, 'events_volume')
  const eventsTotal = events.reduce((sum, point) => sum + point.value, 0)
  const eventDays = Math.max(Math.ceil((window.end.getTime() - eventsStart.getTime()) / DAY_MS), 1)
  const peak = events.reduce<ReportPoint | null>(
    (best, point) => (best === null || point.value > best.value ? point : best),
    null,
  )
  const count = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

  const revenueStatus: ReportStatus = statusOf(revenueAll, revenue.value === null)
  const openCustomer = (customerId: string) =>
    void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })
  const retry =
    (...queries: { refetch: () => unknown }[]) =>
    () => {
      for (const query of queries) void query.refetch()
    }

  return (
    <RevenueReport
      title="Reports"
      filters={{
        range: search.range,
        rangeOptions: RANGE_OPTIONS,
        onRangeChange: (next) => onSearchChange({ ...search, range: next as RangeId }),
        grain: search.grain,
        grainOptions: GRAIN_OPTIONS,
        onGrainChange: (next) => onSearchChange({ ...search, grain: next as GrainChoice }),
        compare: search.compare,
        compareOptions: COMPARE_OPTIONS,
        onCompareChange: (next) => onSearchChange({ ...search, compare: next }),
        currency,
        currencyOptions: currencies.map((code) => ({ id: code, label: code })),
        onCurrencyChange: (next) => onSearchChange({ ...search, currency: next }),
      }}
      rangeLabel={rangeLabel}
      comparing={comparing}
      view={search.view}
      onViewChange={(view) => onSearchChange({ ...search, view })}
      headline={{
        status: revenueStatus === 'loading' || revenueStatus === 'error' ? revenueStatus : 'ready',
        revenue: {
          ...figure(revenue, moneyOrDash),
          ...(comparing
            ? {}
            : { detail: `${rangeLabel.charAt(0).toUpperCase()}${rangeLabel.slice(1)}` }),
        },
        arpu: figure(arpu, moneyOrDash),
        outstanding: {
          value: receivablesReport.data ? money(outstanding) : '—',
          detail: 'As of today',
        },
        overdue: {
          value: agingReport.data ? money(overdue) : '—',
          detail:
            outstanding > 0
              ? `${percentOf(overdue, outstanding)} of outstanding`
              : 'Nothing overdue',
        },
      }}
      revenue={{
        status: statusOf(revenueSeries, points.length === 0),
        reason: revenueSeries.isError ? 'The billing report did not respond.' : undefined,
        onRetry: retry(revenueAll, revenueSeries),
        total: figure(revenue, moneyOrDash),
        usage: { value: summary ? money(usage) : '—' },
        contract: { value: summary ? money(contract) : '—' },
        usageShare: percentOf(usage, usage + contract),
        grain,
        series: points,
      }}
      customers={{
        status: statusOf(revenueByCustomer, customerRows.length === 0),
        reason: revenueByCustomer.isError ? 'The billing report did not respond.' : undefined,
        onRetry: retry(revenueByCustomer, arpuReport),
        rows: customerRows,
        billed: customerRows.length,
        arpu: figure(arpu, moneyOrDash),
        topTenShare: percentOf(
          customerRows.slice(0, 10).reduce((sum, row) => sum + row.revenue, 0),
          total,
        ),
        onOpenCustomer: openCustomer,
        credits: {
          status: statusOf(creditReport, credits.length === 0),
          reason: 'The credit report did not respond.',
          onRetry: retry(creditReport),
          rows: credits,
          total: money(credits.reduce((sum, row) => sum + row.total, 0)),
          toppedUp: topupReport.data
            ? money(topupBreakdown.reduce((sum, row) => sum + row.value, 0))
            : '—',
          consumedTypes: creditTypeRows(creditBreakdown, 'credit_type', CREDIT_TYPES, money),
          topupTypes: creditTypeRows(topupBreakdown, 'transaction_reason', TOPUP_SOURCES, money),
          paidShare: percentOf(
            credits.reduce((sum, row) => sum + row.paid, 0),
            credits.reduce((sum, row) => sum + row.total, 0),
          ),
          basedOn: 'Credits applied to invoices, at the debit conversion rate.',
        },
      }}
      receivables={{
        status: statusOf(
          receivablesReport.isError && !receivablesReport.data ? receivablesReport : agingReport,
          outstanding <= 0 && aging.length === 0,
        ),
        reason:
          agingReport.isError || receivablesReport.isError
            ? 'The receivables report did not respond.'
            : 'No finalized invoice has an unpaid balance.',
        onRetry: retry(receivablesReport, agingReport, agingByCustomer),
        buckets: Object.entries(AGING).map(([key, bucket]) => {
          const amount = aging.find((row) => row.keys['aging_bucket'] === key)?.value ?? 0
          return { ...bucket, amount, display: money(amount) }
        }),
        outstanding: receivablesReport.data ? money(outstanding) : '—',
        overdue: money(overdue),
        overdueShare: percentOf(overdue, outstanding),
        notYetDue: money(notYetDue),
        noDueDate: '—',
        customers: overdueRows,
        onOpenCustomer: openCustomer,
      }}
      payments={{
        status: statusOf(daysReport, days.value === null),
        reason: daysReport.isError
          ? 'The days-to-pay report did not respond.'
          : 'No invoice was paid in this range.',
        onRetry: retry(daysReport, daysSeries, daysByCustomer),
        average: {
          value: days.value === null ? '—' : `${Math.round(days.value)} days`,
          change: comparing ? days.change : null,
          lowerIsBetter: true,
        },
        median: '—',
        withinWeek: '—',
        series: alignToWindow(
          reportSeries(daysSeries.data, 'days_to_pay', currency).map((point) => ({
            at: point.bucket,
            value: point.value,
          })),
          window,
          payGrain,
          false,
          null,
          false,
        ).map((point) => ({
          label: point.label,
          days: point.value === null ? null : Math.round(point.value),
        })),
        payers,
        onOpenCustomer: openCustomer,
      }}
      usage={{
        status: statusOf(eventsReport, events.length === 0),
        reason: eventsReport.isError ? 'The events report did not respond.' : undefined,
        onRetry: retry(eventsReport),
        ...(eventsLimited
          ? {
              basedOn:
                'The last 7 days. Usage analytics has no tenant-wide series, and the events report covers at most a week.',
            }
          : {}),
        series: alignToWindow(
          events.map((point) => ({ at: point.bucket, value: point.value })),
          { start: eventsStart, end: window.end },
          'day',
        ).map((point) => ({
          label: point.label,
          events: point.value ?? 0,
        })),
        total: count.format(eventsTotal),
        weeklyAverage: count.format(eventsTotal / eventDays),
        peak: peak ? `${count.format(peak.value)} on ${dayLabel.format(peak.bucket)}` : '—',
      }}
    />
  )
}
