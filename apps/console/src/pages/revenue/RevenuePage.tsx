import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  useInvoices,
  usePayments,
  useRevenueOverview,
  useRevenueSeries,
  useUsageAnalytics,
  UsageWindowSize,
} from '@fp/query'
import { DEFAULT_INVOICE_QUERY, DEFAULT_PAYMENT_QUERY, PaymentStatus } from '@fp/domain'
import { RevenueReport, type ReportStatus } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import type { RevenueSearch } from '@/app/revenueSearch'
import {
  COMPARE_OPTIONS,
  RANGE_OPTIONS,
  amountOf,
  change,
  customerRows,
  daysToPay,
  eventsSummary,
  formatAmount,
  percentOf,
  previousWindow,
  rangeWindow,
  receivables,
  revenueSeries,
  type RangeId,
} from './revenueReport'

/**
 * Revenue, on the reference report: filters, four headline tiles and six
 * report tabs. This file chooses each report's data and state; `RevenueReport`
 * only draws.
 *
 * Where each report comes from:
 *
 *   - **Revenue, usage and contract totals, customers, ARPU** —
 *     `POST /dashboard/revenue-dashboard` for the window (and the window
 *     before it when comparing). ARPU is that total over the customers billed.
 *   - **Revenue over time** — `POST /analytics/revenue` per day, summed into
 *     the range's buckets. Needs the tenant's revenue analytics setting; where
 *     it is off, the chart says so and the totals still show.
 *   - **Outstanding, overdue and aging** — the unpaid balance on the newest
 *     open invoices. Computed here, so the panel says how many it read.
 *   - **Days to pay** — succeeded payments joined to their invoice's issue
 *     date, for the invoices loaded. A sample, and labelled as one.
 *   - **Events volume** — `POST /events/analytics` per day.
 *   - **Wallet credits** — no tenant-wide source, so the panel states the gap.
 */

/** How many invoices and payments the receivables and days-to-pay reports read. */
const SAMPLE = 200

const CREDITS_UNAVAILABLE =
  'Flexprice has no tenant-wide wallet report yet. Credits topped up and consumed are shown per customer, on their Wallet tab.'

export function RevenuePage({
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
  const before = useMemo(() => previousWindow(window), [window])
  const rangeLabel = (
    RANGE_OPTIONS.find((option) => option.id === search.range)?.label ?? 'Last 90 days'
  ).toLowerCase()

  const overview = useRevenueOverview(environmentId, window)
  const priorOverview = useRevenueOverview(comparing ? environmentId : null, before)
  const series = useRevenueSeries(window)
  const priorSeries = useRevenueSeries(before)
  const invoices = useInvoices({
    ...DEFAULT_INVOICE_QUERY,
    pageSize: SAMPLE,
    sortBy: 'issuedAt',
    sortDirection: 'desc',
  })
  const payments = usePayments({
    ...DEFAULT_PAYMENT_QUERY,
    pageSize: SAMPLE,
    statuses: [PaymentStatus.Succeeded],
  })
  const events = useUsageAnalytics({ window, windowSize: UsageWindowSize.Day })

  // The currency billed to the most customers leads, unless one was chosen.
  const currencies = (overview.data?.summaries ?? []).map((summary) =>
    summary.currency.toUpperCase(),
  )
  const currency =
    (search.currency && currencies.includes(search.currency) ? search.currency : currencies[0]) ??
    'USD'
  const summary = overview.data?.summaries.find((row) => row.currency.toUpperCase() === currency)
  const priorSummary = priorOverview.data?.summaries.find(
    (row) => row.currency.toUpperCase() === currency,
  )

  const total = amountOf(summary?.total)
  const usage = amountOf(summary?.usage)
  const contract = amountOf(summary?.fixed)
  const rows = customerRows(overview.data?.customers ?? [], currency)
  const priorRows = customerRows(priorOverview.data?.customers ?? [], currency)
  const arpu = rows.length ? total / rows.length : 0
  const priorTotal = amountOf(priorSummary?.total)
  const priorArpu = priorRows.length ? priorTotal / priorRows.length : 0

  const overviewStatus: ReportStatus = overview.isPending
    ? 'loading'
    : overview.isError && !overview.data
      ? 'error'
      : summary
        ? 'ready'
        : 'empty'

  const owed = receivables(invoices.data?.invoices ?? [], currency)
  const loadedInvoices = invoices.data?.invoices.length ?? 0
  const invoicesBasedOn = `From the latest ${loadedInvoices} invoices${
    (invoices.data?.total ?? 0) > loadedInvoices ? ` of ${invoices.data?.total}` : ''
  }.`
  const receivablesStatus: ReportStatus = invoices.isPending
    ? 'loading'
    : invoices.isError && !invoices.data
      ? 'error'
      : owed.outstanding > 0
        ? 'ready'
        : 'empty'

  const paymentRows = payments.data?.payments ?? []
  const invoiceRows = invoices.data?.invoices ?? []
  const paid = daysToPay(paymentRows, invoiceRows, window, window.grain, currency)
  const priorPaid = daysToPay(paymentRows, invoiceRows, before, window.grain, currency)
  const paymentsStatus: ReportStatus =
    payments.isPending || invoices.isPending
      ? 'loading'
      : payments.isError && !payments.data
        ? 'error'
        : paid.paidCount > 0
          ? 'ready'
          : 'empty'

  const points = revenueSeries(
    series.data ?? [],
    currency,
    window,
    window.grain,
    comparing ? { days: priorSeries.data ?? [], window: before } : undefined,
  )
  const seriesStatus: ReportStatus = series.isPending
    ? 'loading'
    : series.isError && !series.data
      ? 'unavailable'
      : overviewStatus

  const eventSummary = eventsSummary(events.data?.points ?? [])
  const eventsStatus: ReportStatus = events.isPending
    ? 'loading'
    : events.isError && !events.data
      ? 'error'
      : eventSummary.empty
        ? 'empty'
        : 'ready'

  const money = (value: number) => formatAmount(value, currency)
  const openCustomer = (customerId: string) =>
    void navigate({ to: '/customers/$customerId', params: { customerId }, search: {} as never })

  return (
    <RevenueReport
      filters={{
        range: search.range,
        rangeOptions: RANGE_OPTIONS,
        onRangeChange: (range) => onSearchChange({ ...search, range: range as RangeId }),
        compare: search.compare,
        compareOptions: COMPARE_OPTIONS,
        onCompareChange: (compare) => onSearchChange({ ...search, compare }),
        currency,
        currencyOptions: currencies.map((code) => ({ id: code, label: code })),
        onCurrencyChange: (next) => onSearchChange({ ...search, currency: next }),
      }}
      rangeLabel={rangeLabel}
      comparing={comparing}
      view={search.view}
      onViewChange={(view) => onSearchChange({ ...search, view })}
      headline={{
        status:
          overviewStatus === 'loading' || overviewStatus === 'error' ? overviewStatus : 'ready',
        revenue: {
          value: money(total),
          detail: comparing
            ? `vs ${money(priorTotal)}`
            : `${rangeLabel.charAt(0).toUpperCase()}${rangeLabel.slice(1)}`,
          change: comparing ? change(total, priorTotal) : null,
        },
        arpu: {
          value: money(arpu),
          detail: `${rows.length} billed customer${rows.length === 1 ? '' : 's'}`,
          change: comparing ? change(arpu, priorArpu) : null,
        },
        outstanding: {
          value: invoices.data ? money(owed.outstanding) : '—',
          detail: 'As of today',
        },
        overdue: {
          value: invoices.data ? money(owed.overdue) : '—',
          detail:
            owed.outstanding > 0
              ? `${percentOf(owed.overdue, owed.outstanding)} of outstanding`
              : 'Nothing overdue',
        },
      }}
      revenue={{
        status: seriesStatus,
        reason:
          seriesStatus === 'unavailable'
            ? 'Revenue over time needs revenue analytics, which is not turned on for this environment. The totals above still come from your invoices.'
            : seriesStatus === 'error'
              ? 'The revenue report did not respond.'
              : undefined,
        onRetry: () => void overview.refetch(),
        total: { value: money(total), change: comparing ? change(total, priorTotal) : null },
        usage: {
          value: money(usage),
          change: comparing ? change(usage, amountOf(priorSummary?.usage)) : null,
        },
        contract: {
          value: money(contract),
          change: comparing ? change(contract, amountOf(priorSummary?.fixed)) : null,
        },
        usageShare: percentOf(usage, total),
        grain: window.grain,
        series: points,
      }}
      customers={{
        status: overviewStatus === 'ready' && rows.length === 0 ? 'empty' : overviewStatus,
        reason: overviewStatus === 'error' ? 'The revenue dashboard did not respond.' : undefined,
        onRetry: () => void overview.refetch(),
        rows,
        billed: rows.length,
        arpu: { value: money(arpu), change: comparing ? change(arpu, priorArpu) : null },
        topTenShare: percentOf(
          rows.slice(0, 10).reduce((sum, row) => sum + row.revenue, 0),
          total,
        ),
        onOpenCustomer: openCustomer,
      }}
      receivables={{
        status: receivablesStatus,
        reason:
          receivablesStatus === 'error'
            ? 'Invoices could not be loaded.'
            : 'No finalized invoice has an unpaid balance.',
        onRetry: () => void invoices.refetch(),
        basedOn: invoicesBasedOn,
        buckets: owed.buckets,
        outstanding: money(owed.outstanding),
        overdue: money(owed.overdue),
        overdueShare: percentOf(owed.overdue, owed.outstanding),
        notYetDue: money(owed.notYetDue),
        noDueDate: money(owed.noDueDate),
        customers: owed.customers,
        onOpenCustomer: openCustomer,
      }}
      payments={{
        status: paymentsStatus,
        reason:
          paymentsStatus === 'error'
            ? 'Payments could not be loaded.'
            : 'No payment in this range settled an invoice among those loaded.',
        onRetry: () => void payments.refetch(),
        basedOn: `From the latest ${SAMPLE} succeeded payments, matched to the invoices they settled.`,
        average: {
          value: paid.average === null ? '—' : `${paid.average} days`,
          change:
            comparing && paid.average !== null && priorPaid.average
              ? change(paid.average, priorPaid.average)
              : null,
          lowerIsBetter: true,
        },
        median: paid.median === null ? '—' : `${Math.round(paid.median)} days`,
        paidCount: paid.paidCount,
        withinWeek: paid.withinWeek === null ? '—' : `${Math.round(paid.withinWeek * 100)}%`,
        series: paid.series,
        payers: paid.payers,
        onOpenCustomer: openCustomer,
      }}
      usage={{
        status: eventsStatus,
        reason: eventsStatus === 'error' ? 'Event analytics did not respond.' : undefined,
        onRetry: () => void events.refetch(),
        series: eventSummary.series,
        total: eventSummary.total,
        weeklyAverage: eventSummary.average,
        peak: eventSummary.peak,
        creditsReason: CREDITS_UNAVAILABLE,
      }}
    />
  )
}
