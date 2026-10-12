import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  useCustomers,
  useInvoices,
  useSubscriptions,
  useUsageAnalytics,
  UsageWindowSize,
} from '@fp/query'
import type { UsageAnalytics } from '@fp/query'
import {
  CustomerSortField,
  DEFAULT_INVOICE_QUERY,
  DEFAULT_SUBSCRIPTION_QUERY,
  InvoiceStatus,
} from '@fp/domain'
import type { Customer, Invoice, Money, Subscription } from '@fp/domain'
import { DashboardHome } from '@fp/ui/pages'
import { qualityOf, withoutData } from './queryView'
import type { QueryView } from './queryView'
import type {
  CustomersPanel,
  EventsPanel,
  FilterOption,
  InvoicesPanel,
  SubscriptionsPanel,
} from '@fp/ui/pages'

/**
 * Home — the console overview, wired to what the API can actually answer.
 *
 * This file is where the honesty of the surface is decided. `DashboardHome` is
 * presentational; it renders whatever panel status it is handed. Choosing that
 * status — ready, empty, or unavailable — is this component's whole job, and
 * the rule it follows is that a number reaches the screen only if a request
 * returned it.
 *
 * Four panels are read from live queries:
 *
 *   - **Revenue and usage ingestion** from `useUsageAnalytics`, the hook over
 *     `POST /events/analytics`. It is the only time-series the platform
 *     exposes.
 *   - **Customers** from `useCustomers`, newest first, counted and bucketed
 *     here by creation date.
 *   - **Recent subscriptions** from `useSubscriptions`, bucketed here by start
 *     date. Note the deliberate use of `total` from the *rows*, not from the
 *     page: `SubscriptionPage.total` is the unfiltered server total, so a
 *     dashboard tile built on it would silently report every subscription ever
 *     created as new this week.
 *   - **Invoice payment status** from `useInvoices`, bucketed by the domain's
 *     own derived status.
 *
 * Usage by feature and API key health are parked until quota-based metrics
 * land: the surface no longer renders them, so their queries and shaping are
 * commented out below rather than fetched for nothing.
 */

const DAY_MS = 86_400_000

interface RangeSpec extends FilterOption {
  days: number
}

const RANGES: RangeSpec[] = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
]

const GRANULARITIES: (FilterOption & { windowSize: UsageWindowSize })[] = [
  { id: 'hourly', label: 'Hourly', windowSize: UsageWindowSize.Hour },
  { id: 'daily', label: 'Daily', windowSize: UsageWindowSize.Day },
  { id: 'weekly', label: 'Weekly', windowSize: UsageWindowSize.Week },
]

/** Midnight UTC `daysAgo` days back — the boundary every window is cut on. */
function dayStart(daysAgo: number): Date {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

/*
 * Every label is cut in UTC, because every window is: `dayStart` buckets on
 * midnight UTC, so a label in the browser's zone would put a bucket's events
 * under the wrong date.
 */
const dayLabel = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
/*
 * The subscription matrix's axis, which carries the day alone.
 *
 * Its columns are narrow — seven of them share the half-width panel — and
 * "24 Sep" under each one either wraps or ellipses. The month is already in
 * the panel's own description ("New in the last 7 days"), so repeating it
 * seven times spends the only horizontal room the axis has on the one part
 * that does not change.
 */
const columnDayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone: 'UTC' })
const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', timeZone: 'UTC' })
// Parked with `toUsagePanel` until quota-based metrics land.
// const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

/** The most columns the subscription stack is drawn with. See `toSubscriptionsPanel`. */
const MAX_COLUMNS = 7

/**
 * What one column of the subscription stack is called.
 *
 * A single day is its own date; a longer bucket names both ends, because a
 * column labelled "Sep 23" that actually counts five days is the kind of
 * quietly wrong axis nobody thinks to check.
 *
 * `formatRange` rather than two formatted dates glued together: it is the only
 * version that stays right in every locale. Building "5–Sep 9" by hand reads
 * backwards the moment the locale puts the month first, which en-US does.
 */
function bucketLabel(start: Date, last: Date): string {
  if (start.getTime() === last.getTime()) return columnDayLabel.format(start)
  // A multi-day bucket needs the month back: "23–27" spanning a boundary is
  // ambiguous in a way a single day is not.
  return dayLabel.formatRange(start, last)
}

/**
 * Percentage change between two windows, or `null` when there is nothing to
 * compare against.
 *
 * Growth from zero is not a percentage — it is "the first one" — and printing
 * `+100%` or `+∞%` for it is the kind of confident nonsense this surface exists
 * to avoid.
 */
function change(current: number, prior: number): number | null {
  if (prior <= 0) return null
  return ((current - prior) / prior) * 100
}

export function HomePage() {
  const navigate = useNavigate()
  const [rangeId, setRangeId] = useState('7d')
  const [granularityId, setGranularityId] = useState('daily')

  const range = RANGES.find((entry) => entry.id === rangeId) ?? RANGES[0]!
  const granularity = GRANULARITIES.find((entry) => entry.id === granularityId) ?? GRANULARITIES[1]!

  /*
   * Both windows are derived from one `now` per render pass, so the current and
   * prior windows are exactly adjacent and the same width. Two independent
   * `Date.now()` calls would leave a sliver of time in neither.
   */
  const windows = useMemo(() => {
    const end = new Date()
    const start = dayStart(range.days)
    const priorEnd = start
    const priorStart = new Date(start.getTime() - range.days * DAY_MS)
    return { current: { start, end }, prior: { start: priorStart, end: priorEnd } }
  }, [range.days])

  /*
   * Newest first, so once a row falls before the window every row after it is
   * older still — which makes the new-customer count exact, unless the whole
   * page is inside the window, in which case the panel says the figure is a floor.
   */
  const customers = useCustomers({
    page: 1,
    pageSize: 100,
    search: '',
    statuses: [],
    sortBy: CustomerSortField.CreatedAt,
    sortDirection: 'desc',
  })

  const analytics = useUsageAnalytics({
    window: windows.current,
    windowSize: granularity.windowSize,
  })
  // The window before this one, so the tab strip's changes are two real
  // measurements compared. The granularity is irrelevant to the totals it feeds.
  const priorAnalytics = useUsageAnalytics({
    window: windows.prior,
    windowSize: UsageWindowSize.Day,
  })

  /*
   * A page large enough that every row inside the window is on it. Sorted
   * newest-first by the server, so once the rows fall out of the window the
   * rest are older still — which is what makes counting them here exact rather
   * than a sample. When the page is full and still inside the window, the
   * panel says so (`basedOn`) instead of presenting a floor as a total.
   */
  const subscriptions = useSubscriptions({
    ...DEFAULT_SUBSCRIPTION_QUERY,
    pageSize: 100,
    sortBy: 'startDate',
    sortDirection: 'desc',
  })
  const invoices = useInvoices({
    ...DEFAULT_INVOICE_QUERY,
    pageSize: 100,
    sortBy: 'issuedAt',
    sortDirection: 'desc',
  })
  // Parked with the API panel until quota-based metrics land.
  // const apiKeys = useApiKeys()

  const eventsPanel = toEventsPanel(analytics, priorAnalytics, granularityId)
  const customersPanel = toCustomersPanel(customers, windows, range.days)

  /*
   * Parked until quota-based metrics land.
   *
   * const usagePanel = toUsagePanel(analytics.data, priorAnalytics.data, analytics.isPending, analytics.isError)
   */

  const subscriptionsPanel = toSubscriptionsPanel(subscriptions, windows, range.days)
  const invoicesPanel = toInvoicesPanel(invoices, windows)

  return (
    <DashboardHome
      rangeOptions={RANGES.map(({ id, label }) => ({ id, label }))}
      range={rangeId}
      onRangeChange={setRangeId}
      granularityOptions={GRANULARITIES.map(({ id, label }) => ({ id, label }))}
      granularity={granularityId}
      onGranularityChange={setGranularityId}
      rangeLabel={range.label.toLowerCase()}
      events={eventsPanel}
      customers={customersPanel}
      subscriptions={subscriptionsPanel}
      invoices={invoicesPanel}
      onNavigate={(path) => void navigate({ to: path, search: {} as never })}
    />
  )
}

/* ---- Shaping the panels -------------------------------------------------- */

function toEventsPanel(
  view: QueryView<UsageAnalytics>,
  prior: QueryView<UsageAnalytics>,
  granularityId: string,
): EventsPanel {
  const meta = qualityOf(view)
  const data = view.data
  if (data === undefined) {
    return { ...meta, status: withoutData(view), points: [], total: null, revenue: null }
  }
  if (data.points.length === 0) {
    return { ...meta, status: 'empty', points: [], total: null, revenue: null }
  }

  const format = granularityId === 'hourly' ? hourLabel : dayLabel
  // A change is two real measurements compared. A prior window that is itself
  // a held-over copy of another window is not one.
  const priorData = prior.data !== undefined && !prior.isPlaceholderData ? prior.data : undefined

  return {
    ...meta,
    status: 'ready',
    points: data.points.map((point) => ({
      label: format.format(point.timestamp),
      events: point.eventCount,
    })),
    total: data.eventCount,
    revenue: data.revenue,
    totalChangePercent:
      priorData === undefined || view.isPlaceholderData
        ? null
        : change(data.eventCount, priorData.eventCount),
    revenueChangePercent:
      priorData === undefined || view.isPlaceholderData
        ? null
        : revenueChange(data.revenue, priorData.revenue),
  }
}

/*
 * Parked until quota-based metrics land, with the usage-by-feature panel.
 *
 * function toUsagePanel(
 *   data: UsageAnalytics | undefined,
 *   prior: UsageAnalytics | undefined,
 *   isPending: boolean,
 *   isError: boolean,
 * ): UsagePanel {
 *   if (isError) return { status: 'unavailable', rows: [] }
 *   if (isPending || data === undefined) return { status: 'loading', rows: [] }
 *   if (data.features.length === 0) return { status: 'empty', rows: [] }
 *
 *   const priorByFeature = new Map(prior?.features.map((row) => [row.featureId, row.usage]) ?? [])
 *
 *   /*
 *    * Both the number and its rendering. The meter ranks features against each
 *    * other, so it needs `quantity` to measure with; `value` is the same figure
 *    * carrying its own unit, because "428K" alone is not an answer when the row
 *    * below it counts tokens.
 *    *\/
 *   const rows: UsageRow[] = data.features.slice(0, 5).map((feature) => ({
 *     featureId: feature.featureId,
 *     name: feature.name,
 *     lookupKey: feature.lookupKey,
 *     quantity: feature.usage,
 *     value: `${compact.format(feature.usage)} ${feature.unitPlural}`,
 *     changePercent: change(feature.usage, priorByFeature.get(feature.featureId) ?? 0),
 *   }))
 *
 *   return { status: 'ready', rows }
 * }
 */

/**
 * Change between two priced subtotals. Only comparable in one currency, and
 * the server's two decimal strings are compared as a ratio — never summed or
 * displayed — so the browser does no money arithmetic.
 */
function revenueChange(current: Money | null, prior: Money | null): number | null {
  if (current === null || prior === null || current.currency !== prior.currency) return null
  return change(Number(current.amount), Number(prior.amount))
}

interface Windows {
  current: { start: Date; end: Date }
  prior: { start: Date; end: Date }
}

/** The earliest of a set of dates, or `null` when there are none. */
function earliest(dates: (Date | null)[]): Date | null {
  let min: Date | null = null
  for (const at of dates) {
    if (at !== null && (min === null || at < min)) min = at
  }
  return min
}

function toCustomersPanel(
  view: QueryView<{ customers: Customer[]; total: number }>,
  windows: Windows,
  days: number,
): CustomersPanel {
  const meta = qualityOf(view)
  const blank = { newCount: null, partial: false, points: [] }
  const page = view.data
  if (page === undefined) return { ...meta, ...blank, status: withoutData(view) }

  const rows = page.customers
  const total = page.total
  const window = windows.current
  const dates = rows.map((row) => row.createdAt).filter((at): at is Date => at !== null)
  const created = dates.filter((at) => at >= window.start && at < window.end)
  if (created.length === 0) return { ...meta, ...blank, status: 'empty', newCount: 0 }

  // Every row on the page is new and the server holds more: the count is a floor.
  const partial = created.length === rows.length && total > rows.length

  // A point per day, oldest first, so a quiet day is a zero rather than a gap.
  const points = Array.from({ length: days + 1 }, (_, index) => {
    const start = dayStart(days - index)
    const end = new Date(start.getTime() + DAY_MS)
    return {
      label: dayLabel.format(start),
      customers: created.filter((at) => at >= start && at < end).length,
    }
  })

  /*
   * The prior window is only countable when the page reaches back past its
   * start (newest first, so nothing older is hiding) or already holds every
   * customer. Otherwise the earlier count would be a floor posing as a total,
   * and no change is shown.
   */
  const priorComplete = total <= rows.length || dates.some((at) => at < windows.prior.start)
  const priorCount = dates.filter(
    (at) => at >= windows.prior.start && at < windows.prior.end,
  ).length
  const changePercent = partial || !priorComplete ? null : change(created.length, priorCount)

  return {
    ...meta,
    status: 'ready',
    newCount: created.length,
    partial,
    points,
    changePercent,
    basedOn: partial
      ? `Counted from the newest ${rows.length.toLocaleString()} customers.`
      : undefined,
  }
}

function toSubscriptionsPanel(
  view: QueryView<{ subscriptions: Subscription[]; total: number }>,
  windows: Windows,
  days: number,
): SubscriptionsPanel {
  const meta = qualityOf(view)
  const blank = { total: 0, changePercent: null, days: [], plans: [] }
  const page = view.data
  if (page === undefined) return { ...meta, ...blank, status: withoutData(view) }

  const rows = page.subscriptions

  /** A subscription's own start date is what "new in this period" means. */
  const startedAt = (row: Subscription) => row.startDate ?? row.createdAt
  const startedIn = (window: { start: Date; end: Date }) =>
    rows.filter((row) => {
      const at = startedAt(row)
      return at !== null && at >= window.start && at < window.end
    })

  const current = startedIn(windows.current)
  if (current.length === 0) return { ...meta, ...blank, status: 'empty' }

  /*
   * The page is newest first and the server holds more than it returned: a
   * window the oldest loaded row is still inside may have older members that
   * were never fetched. Then the figure is a floor and its change against the
   * prior window is not computable.
   */
  const truncated = page.total > rows.length
  const oldest = earliest(rows.map(startedAt))
  const currentComplete = !truncated || (oldest !== null && oldest < windows.current.start)
  const priorComplete = !truncated || (oldest !== null && oldest < windows.prior.start)

  const byPlanTotal = new Map<string, number>()
  for (const row of current) {
    byPlanTotal.set(row.planName, (byPlanTotal.get(row.planName) ?? 0) + 1)
  }
  const plans = [...byPlanTotal.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 4)
  const drawn = new Set(plans.map((plan) => plan.name))

  /*
   * Columns, oldest first, so a quiet stretch is a gap rather than a period
   * that silently disappears from the axis.
   *
   * A day per column only while the window is short enough for it. `PillColumns`
   * draws a countable stack of segments per column, which is a low-cardinality
   * mark by design — ninety of them would be slivers, and the gaps alone would
   * be wider than the panel. So a long window is bucketed rather than
   * truncated: every subscription inside it is still counted, in a column that
   * spans several days and says so on the axis.
   */
  const bucketDays = Math.max(1, Math.ceil(days / MAX_COLUMNS))
  const buckets: { label: string; byPlan: Record<string, number> }[] = []
  for (let offset = days - 1; offset >= 0; offset -= bucketDays) {
    const start = dayStart(offset)
    const last = dayStart(Math.max(offset - bucketDays + 1, 0))
    const end = new Date(last.getTime() + DAY_MS)
    const byPlan: Record<string, number> = {}
    for (const row of current) {
      const at = startedAt(row)
      if (at === null || at < start || at >= end) continue
      if (!drawn.has(row.planName)) continue
      byPlan[row.planName] = (byPlan[row.planName] ?? 0) + 1
    }
    buckets.push({ label: bucketLabel(start, last), byPlan })
  }

  return {
    ...meta,
    status: 'ready',
    total: current.length,
    changePercent:
      currentComplete && priorComplete
        ? change(current.length, startedIn(windows.prior).length)
        : null,
    days: buckets,
    plans,
    basedOn: currentComplete
      ? undefined
      : `Based on the latest ${rows.length.toLocaleString()} subscriptions; older ones may also fall in this period.`,
  }
}

function toInvoicesPanel(
  view: QueryView<{ invoices: Invoice[]; total: number }>,
  windows: Windows,
): InvoicesPanel {
  const meta = qualityOf(view)
  const blank = { total: 0, paid: 0, open: 0, overdue: 0 }
  const page = view.data
  if (page === undefined) return { ...meta, ...blank, status: withoutData(view) }

  const window = windows.current
  // Issued inside the window — "finalized in the last 7 days", in the domain's
  // vocabulary. A draft has no issue date and is not finalized, so it is out.
  const issued = page.invoices.filter(
    (row) => row.issuedAt !== null && row.issuedAt >= window.start && row.issuedAt < window.end,
  )
  if (issued.length === 0) return { ...meta, ...blank, status: 'empty' }

  const count = (status: string) => issued.filter((row) => row.status === status).length

  // Newest first by issue date: a window the oldest loaded row is still inside
  // may continue past the page, so the split is of "the latest N" and says so.
  const oldest = earliest(page.invoices.map((row) => row.issuedAt))
  const complete = page.total <= page.invoices.length || (oldest !== null && oldest < window.start)

  return {
    ...meta,
    status: 'ready',
    total: issued.length,
    paid: count(InvoiceStatus.Paid),
    open: count(InvoiceStatus.Open),
    overdue: count(InvoiceStatus.Overdue),
    basedOn: complete
      ? undefined
      : `Based on the latest ${page.invoices.length.toLocaleString()} invoices.`,
  }
}

/*
 * Parked until quota-based metrics land, with the API panel.
 *
 * function toApiPanel(
 *   keys: { status: string; lastUsedAt: Date | null; expiresAt: Date | null }[],
 *   isPending: boolean,
 *   isError: boolean,
 * ): ApiPanel {
 *   if (isError) return { status: 'unavailable', activeKeys: 0, totalKeys: 0, lastUsedLabel: null }
 *   if (isPending) return { status: 'loading', activeKeys: 0, totalKeys: 0, lastUsedLabel: null }
 *   if (keys.length === 0) {
 *     return { status: 'empty', activeKeys: 0, totalKeys: 0, lastUsedLabel: null }
 *   }
 *
 *   const lastUsed = keys
 *     .map((key) => key.lastUsedAt)
 *     .filter((at): at is Date => at !== null)
 *     .sort((a, b) => b.getTime() - a.getTime())[0]
 *
 *   return {
 *     status: 'ready',
 *     activeKeys: keys.filter((key) => isActive(key as never)).length,
 *     totalKeys: keys.length,
 *     lastUsedLabel: lastUsed !== undefined ? dayLabel.format(lastUsed) : null,
 *   }
 * }
 */
