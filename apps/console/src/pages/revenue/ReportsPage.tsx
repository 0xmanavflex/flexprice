import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  reportBreakdown,
  reportCurrencies,
  reportScalar,
  reportSeries,
  reportsUnconfigured,
  useCustomerNames,
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
  agingTotals,
  amountOf,
  customerRows as dashboardCustomerRows,
  creditRows,
  creditTypeRows,
  alignToWindow,
  eventsWindow,
  formatAmount,
  largestCurrency,
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

/** How many customers a breakdown lists. */
const TOP = 50

// Customers per page in the full list.
const PAGE = 25

const AGING: Record<
  string,
  { id: string; label: string; tone: AgingBucket['tone']; days: number }
> = {
  '1-30': { id: 'd30', label: '1–30 days', tone: 'warning', days: 30 },
  '31-60': { id: 'd60', label: '31–60 days', tone: 'warning', days: 60 },
  '61-90': { id: 'd90', label: '61–90 days', tone: 'critical', days: 90 },
  '90+': { id: 'd90p', label: '90+ days', tone: 'critical', days: 91 },
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** The status of one report read: loading, failed, nothing to show, or ready. */
const useCardReport = (key: string, query: ReportQuery | null) => useReport(key, query)

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
  // An environment without the report library answers every report the same
  // way, so once the first says so the rest are not asked: the page falls back
  // to the revenue dashboard and hides them.
  const revenueOnly = reportsUnconfigured(revenueAll.error)
  const gated = <Q,>(query: Q): Q | null => (revenueOnly ? null : query)
  const currencies = reportCurrencies(revenueAll.data)
  // Without a choice, the currency with the most revenue: the report lists
  // currencies alphabetically, and the first can be one with next to nothing.
  const currency =
    (search.currency && currencies.includes(search.currency)
      ? search.currency
      : largestCurrency(
          currencies,
          (code) => reportScalar(revenueAll.data, 'invoice_total', code).value ?? 0,
        )) ?? 'USD'
  const inCurrency = { ...base, currency: currency.toLowerCase() }

  const revenueSeries = useCardReport(
    'invoice_total',
    gated({
      ...inCurrency,
      shape: 'timeseries',
      grain,
    }),
  )
  const revenueByCustomer = useCardReport(
    'invoice_total',
    gated({
      ...inCurrency,
      shape: 'breakdown',
      dimensions: ['customer_id'],
      limit: TOP,
    }),
  )
  const creditReport = useCardReport(
    'credit_consumption',
    gated({
      range,
      currency: currency.toLowerCase(),
      shape: 'breakdown',
      dimensions: ['customer_id', 'credit_type'],
    }),
  )
  const [offset, setOffset] = useState(0)
  useEffect(() => setOffset(0), [search.range, currency])
  const customerPage = useCardReport(
    'invoice_total',
    gated({
      range,
      currency: currency.toLowerCase(),
      shape: 'breakdown',
      dimensions: ['customer_id'],
      limit: PAGE + 1,
      offset,
    }),
  )
  const arpuReport = useCardReport('arpu', gated({ ...inCurrency, shape: 'scalar' }))
  const receivablesReport = useCardReport(
    'total_receivables',
    gated({
      range,
      currency: currency.toLowerCase(),
      shape: 'scalar',
    }),
  )
  const agingReport = useCardReport(
    'receivables_aging',
    gated({
      range,
      currency: currency.toLowerCase(),
      shape: 'breakdown',
      dimensions: ['aging_bucket'],
    }),
  )
  const agingByCustomer = useCardReport(
    'receivables_aging',
    gated({
      range,
      currency: currency.toLowerCase(),
      shape: 'breakdown',
      dimensions: ['customer_id', 'aging_bucket'],
    }),
  )
  // Days to pay has no daily grain.
  const payGrain = grain === 'day' ? 'week' : grain
  const daysReport = useCardReport('days_to_pay', gated({ ...inCurrency, shape: 'scalar' }))
  const daysSeries = useCardReport(
    'days_to_pay',
    gated({
      ...inCurrency,
      shape: 'timeseries',
      grain: payGrain,
    }),
  )
  const daysByCustomer = useCardReport(
    'days_to_pay',
    gated({
      ...inCurrency,
      shape: 'breakdown',
      dimensions: ['customer_id'],
      limit: TOP,
    }),
  )
  // `POST /events/analytics` returns no rows without a customer: the tenant
  // path is disabled on the server. `events_volume` is the count that works,
  // and it covers at most seven days.
  const eventsSpan = eventsWindow(window)
  const eventsReport = useCardReport(
    'events_volume',
    gated({
      range: eventsSpan.range,
      shape: 'timeseries',
      grain: 'day',
    }),
  )
  const topupReport = useCardReport(
    'credit_topups',
    gated({
      range,
      currency: currency.toLowerCase(),
      shape: 'breakdown',
      dimensions: ['transaction_reason', 'customer_id'],
    }),
  )
  // The usage and contract split: no report gives it.
  const overview = useRevenueOverview(environmentId, window)

  const revenue = reportScalar(revenueAll.data, 'invoice_total', currency)
  const arpu = reportScalar(arpuReport.data, 'arpu', currency)
  const outstanding = reportScalar(receivablesReport.data, 'total_receivables', currency).value ?? 0
  const aging = reportBreakdown(agingReport.data, 'receivables_aging', ['aging_bucket'], currency)
  const { notYetDue, overdue, noDueDate } = agingTotals(aging)
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
  // usage and contract split. It lists only some customers, so the rest are
  // looked up in one customer search by id.
  const split = new Map(
    dashboardCustomerRows(overview.data?.customers ?? [], currency).map((row) => [row.id, row]),
  )
  const creditBreakdown = reportBreakdown(
    creditReport.data,
    'credit_consumption',
    ['customer_id', 'credit_type'],
    currency,
  )
  const pageBreakdown = reportBreakdown(
    customerPage.data,
    'invoice_total',
    ['customer_id'],
    currency,
  )
  const unnamed = [
    ...customerRevenue,
    ...customerAging,
    ...customerDays,
    ...creditBreakdown,
    ...pageBreakdown.slice(0, PAGE),
  ].flatMap((row) => {
    const id = row.keys['customer_id']
    return id && !split.get(id)?.name ? [id] : []
  })
  const looked = useCustomerNames(overview.isPending ? [] : unnamed)
  const nameOf = (id: string) => split.get(id)?.name || looked.data?.[id] || id

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
    display: {
      revenue: money(point.value ?? 0),
      ...(point.previous != null ? { previous: money(point.previous) } : {}),
    },
  }))

  const topupBreakdown = reportBreakdown(
    topupReport.data,
    'credit_topups',
    ['transaction_reason', 'customer_id'],
    currency,
  )
  const credits = creditRows(creditBreakdown, nameOf, money)
  const toRow = (row: { keys: Record<string, string>; value: number }): CustomerRevenueRow => {
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
  }
  // A customer with nothing billed is not one to rank or chart.
  const customerRows = customerRevenue.filter((row) => row.value > 0).map(toRow)
  const pageRows = pageBreakdown.slice(0, PAGE).map(toRow)

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
      outstanding: entry.outstanding,
      display: { overdue: money(entry.overdue), outstanding: money(entry.outstanding) },
      oldestDays: entry.oldest,
    }))

  const payers: PayerRow[] = customerDays.map((row) => {
    const id = row.keys['customer_id'] ?? ''
    return { id, name: nameOf(id), averageDays: Math.round(row.value) }
  })

  const events = reportSeries(eventsReport.data, 'events_volume')
  const eventsTotal = events.reduce((sum, point) => sum + point.value, 0)
  const eventDays = Math.max(
    Math.ceil((eventsSpan.end.getTime() - eventsSpan.start.getTime()) / DAY_MS),
    1,
  )
  // The events report reaches back a week at most: a wider range says so,
  // under the chart and in the empty state alike.
  const eventsNote = eventsSpan.limited
    ? 'Only the last 7 days are counted: usage analytics has no tenant-wide series, and the events report covers at most a week.'
    : undefined
  const peak = events.reduce<ReportPoint | null>(
    (best, point) => (best === null || point.value > best.value ? point : best),
    null,
  )
  const count = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

  const shown = revenueOnly
    ? (overview.data?.summaries.find((row) => row.currency === search.currency)?.currency ??
      overview.data?.summaries[0]?.currency ??
      currency)
    : currency
  const dashSummary = overview.data?.summaries.find((row) => row.currency === shown)
  const dashRows = dashboardCustomerRows(overview.data?.customers ?? [], shown)
  const dashTotal = amountOf(dashSummary?.total)
  const dashUsage = amountOf(dashSummary?.usage)
  const dashContract = amountOf(dashSummary?.fixed)
  const dashMoney = (value: number) => formatAmount(value, shown)
  const dashStatus: ReportStatus = overview.isPending
    ? 'loading'
    : overview.isError && !overview.data
      ? 'error'
      : dashSummary
        ? 'ready'
        : 'empty'
  const shownView =
    revenueOnly &&
    search.view !== 'overview' &&
    search.view !== 'revenue' &&
    search.view !== 'customers'
      ? 'overview'
      : search.view

  const revenueStatus: ReportStatus = revenueOnly
    ? dashStatus
    : statusOf(revenueAll, revenue.value === null)
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
        // The fallback shows the dashboard currency `shown`; the picker says so.
        currency: revenueOnly ? shown : currency,
        // In the dashboard fallback the report knows no currencies; the
        // dashboard's own summaries are the ones there are.
        currencyOptions: (revenueOnly
          ? (overview.data?.summaries ?? []).map((row) => row.currency)
          : currencies
        ).map((code) => ({ id: code, label: code })),
        onCurrencyChange: (next) => onSearchChange({ ...search, currency: next }),
      }}
      rangeLabel={rangeLabel}
      comparing={comparing}
      {...(revenueOnly ? { revenueOnly: true } : {})}
      view={shownView}
      onViewChange={(view) => onSearchChange({ ...search, view })}
      headline={{
        status: revenueStatus === 'loading' || revenueStatus === 'error' ? revenueStatus : 'ready',
        revenue: revenueOnly
          ? {
              value: dashSummary ? dashMoney(dashTotal) : '—',
              // The dashboard counts invoice lines by service period, not
              // invoices by finalization date as the report does: said so.
              detail: `Service in ${rangeLabel}`,
            }
          : {
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
        // An all-zero series is drawn as the empty state by the chart itself;
        // the totals come from their own read and still show.
        status: revenueOnly ? dashStatus : statusOf(revenueSeries, points.length === 0),
        reason: revenueOnly
          ? overview.isError
            ? 'Revenue could not be loaded.'
            : undefined
          : revenueSeries.isError
            ? 'The billing report did not respond.'
            : undefined,
        onRetry: revenueOnly ? retry(overview) : retry(revenueAll, revenueSeries),
        total: revenueOnly
          ? { value: dashSummary ? dashMoney(dashTotal) : '—' }
          : figure(revenue, moneyOrDash),
        usage: {
          value: revenueOnly
            ? dashSummary
              ? dashMoney(dashUsage)
              : '—'
            : summary
              ? money(usage)
              : '—',
        },
        contract: {
          value: revenueOnly
            ? dashSummary
              ? dashMoney(dashContract)
              : '—'
            : summary
              ? money(contract)
              : '—',
        },
        usageShare: percentOf(
          revenueOnly ? dashUsage : usage,
          (revenueOnly ? dashUsage : usage) + (revenueOnly ? dashContract : contract),
        ),
        grain,
        series: revenueOnly ? [] : points,
      }}
      customers={{
        status: revenueOnly ? dashStatus : statusOf(revenueByCustomer, customerRows.length === 0),
        reason: revenueOnly
          ? overview.isError
            ? 'Revenue could not be loaded.'
            : undefined
          : revenueByCustomer.isError
            ? 'The billing report did not respond.'
            : undefined,
        onRetry: revenueOnly ? retry(overview) : retry(revenueByCustomer, arpuReport),
        rows: revenueOnly ? dashRows : customerRows,
        billed: (revenueOnly ? dashRows : customerRows).length,
        arpu: figure(arpu, moneyOrDash),
        topTenShare: percentOf(
          (revenueOnly ? dashRows : customerRows)
            .slice(0, 10)
            .reduce((sum, row) => sum + row.revenue, 0),
          revenueOnly ? dashTotal : total,
        ),
        onOpenCustomer: openCustomer,
        all: revenueOnly
          ? {
              status: dashStatus,
              rows: dashRows,
              offset: 0,
              size: dashRows.length || PAGE,
              hasMore: false,
              onPage: setOffset,
            }
          : {
              status: customerPage.isPlaceholderData
                ? 'loading'
                : statusOf(customerPage, pageRows.length === 0 && offset === 0),
              reason: 'The customer list did not respond.',
              onRetry: retry(customerPage),
              rows: pageRows,
              offset,
              size: PAGE,
              hasMore: pageBreakdown.length > PAGE,
              onPage: setOffset,
            },
        credits: {
          status: statusOf(
            {
              isPending: creditReport.isPending || topupReport.isPending,
              isError:
                (creditReport.isError && !creditReport.data) ||
                (topupReport.isError && !topupReport.data),
            },
            credits.length === 0 && topupBreakdown.length === 0,
          ),
          // Only a failed read did not respond; an empty one simply has nothing.
          ...((creditReport.isError && !creditReport.data) ||
          (topupReport.isError && !topupReport.data)
            ? { reason: 'The credit reports did not respond.' }
            : {}),
          onRetry: retry(creditReport, topupReport),
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
        noDueDate: agingReport.data ? money(noDueDate) : '—',
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
        status: statusOf(eventsReport, eventsTotal === 0),
        reason: eventsReport.isError ? 'The events report did not respond.' : eventsNote,
        onRetry: retry(eventsReport),
        ...(eventsNote ? { basedOn: eventsNote } : {}),
        series: alignToWindow(
          events.map((point) => ({ at: point.bucket, value: point.value })),
          eventsSpan,
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
