import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  useApiKeys,
  useCustomers,
  useInvoices,
  useSubscriptions,
  useUsageAnalytics,
  UsageWindowSize,
} from '@fp/query'
import type { UsageAnalytics } from '@fp/query'
import {
  DEFAULT_INVOICE_QUERY,
  DEFAULT_SUBSCRIPTION_QUERY,
  InvoiceStatus,
  isActive,
} from '@fp/domain'
import type { Invoice, Subscription } from '@fp/domain'
import { DashboardHome } from '@fp/ui/flexprice'
import type {
  ApiPanel,
  EventsPanel,
  FilterOption,
  InvoicesPanel,
  SubscriptionsPanel,
  UsagePanel,
  UsageRow,
} from '@fp/ui/flexprice'

/**
 * Home — the console overview, wired to what the API can actually answer.
 *
 * This file is where the honesty of the surface is decided. `DashboardHome` is
 * presentational; it renders whatever panel status it is handed. Choosing that
 * status — ready, empty, or unavailable — is this component's whole job, and
 * the rule it follows is that a number reaches the screen only if a request
 * returned it.
 *
 * Three panels are read from live queries:
 *
 *   - **Events, revenue and usage by feature** from `useUsageAnalytics`, the
 *     hook this change added over `POST /events/analytics`. It is the only
 *     time-series the platform exposes. It is fetched twice — the window on
 *     screen and the window before it — so the per-feature change is two real
 *     measurements compared rather than a figure invented to look like growth.
 *   - **Recent subscriptions** from `useSubscriptions`, bucketed here by start
 *     date. Note the deliberate use of `total` from the *rows*, not from the
 *     page: `SubscriptionPage.total` is the unfiltered server total, so a
 *     dashboard tile built on it would silently report every subscription ever
 *     created as new this week.
 *   - **Invoice payment status** from `useInvoices`, bucketed by the domain's
 *     own derived status.
 *
 * And the numbers that are simply not available anywhere — processing lag,
 * request volume, p95 latency, error counts — are rendered as absent by the
 * surface itself, with the reason. See `DashboardHome`.
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

const ALL_CUSTOMERS = 'all'

/** Midnight UTC `daysAgo` days back — the boundary every window is cut on. */
function dayStart(daysAgo: number): Date {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

const dayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

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
  if (start.getTime() === last.getTime()) return dayLabel.format(start)
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
  const [customerId, setCustomerId] = useState(ALL_CUSTOMERS)

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

  // Customers for the filter. One page is plenty for a picker.
  const customers = useCustomers({
    page: 1,
    pageSize: 50,
    search: '',
    statuses: [],
    sortBy: 'name',
    sortDirection: 'asc',
  })

  const externalCustomerId =
    customerId === ALL_CUSTOMERS
      ? undefined
      : (customers.data?.customers.find((entry) => entry.id === customerId)?.externalId ??
        undefined)

  const analytics = useUsageAnalytics({
    window: windows.current,
    windowSize: granularity.windowSize,
    ...(externalCustomerId !== undefined ? { externalCustomerId } : {}),
  })
  const priorAnalytics = useUsageAnalytics({
    window: windows.prior,
    windowSize: granularity.windowSize,
    ...(externalCustomerId !== undefined ? { externalCustomerId } : {}),
  })

  /*
   * A page large enough that every row inside the window is on it. Sorted
   * newest-first by the server, so once the rows fall out of the window the
   * rest are older still — which is what makes counting them here exact rather
   * than a sample.
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
  const apiKeys = useApiKeys()

  const eventsPanel = useMemo<EventsPanel>(
    () => toEventsPanel(analytics.data, analytics.isPending, analytics.isError, granularityId),
    [analytics.data, analytics.isPending, analytics.isError, granularityId],
  )

  const usagePanel = useMemo<UsagePanel>(
    () => toUsagePanel(analytics.data, priorAnalytics.data, analytics.isPending, analytics.isError),
    [analytics.data, priorAnalytics.data, analytics.isPending, analytics.isError],
  )

  const subscriptionsPanel = useMemo<SubscriptionsPanel>(
    () =>
      toSubscriptionsPanel(
        subscriptions.data?.subscriptions ?? [],
        windows,
        range.days,
        subscriptions.isPending,
        subscriptions.isError,
      ),
    [subscriptions.data, subscriptions.isPending, subscriptions.isError, windows, range.days],
  )

  const invoicesPanel = useMemo<InvoicesPanel>(
    () =>
      toInvoicesPanel(
        invoices.data?.invoices ?? [],
        windows.current,
        invoices.isPending,
        invoices.isError,
      ),
    [invoices.data, invoices.isPending, invoices.isError, windows],
  )

  const apiPanel = useMemo<ApiPanel>(
    () => toApiPanel(apiKeys.data?.keys ?? [], apiKeys.isPending, apiKeys.isError),
    [apiKeys.data, apiKeys.isPending, apiKeys.isError],
  )

  const customerOptions: FilterOption[] = [
    { id: ALL_CUSTOMERS, label: 'All customers' },
    ...(customers.data?.customers ?? []).map((entry) => ({ id: entry.id, label: entry.name })),
  ]

  return (
    <div className="h-full overflow-y-auto">
      <DashboardHome
        rangeOptions={RANGES.map(({ id, label }) => ({ id, label }))}
        range={rangeId}
        onRangeChange={setRangeId}
        granularityOptions={GRANULARITIES.map(({ id, label }) => ({ id, label }))}
        granularity={granularityId}
        onGranularityChange={setGranularityId}
        customerOptions={customerOptions}
        customer={customerId}
        onCustomerChange={setCustomerId}
        rangeLabel={range.label.toLowerCase()}
        events={eventsPanel}
        subscriptions={subscriptionsPanel}
        invoices={invoicesPanel}
        usage={usagePanel}
        api={apiPanel}
        onNavigate={(path) => void navigate({ to: path, search: {} as never })}
      />
    </div>
  )
}

/* ---- Shaping the panels -------------------------------------------------- */

function toEventsPanel(
  data: UsageAnalytics | undefined,
  isPending: boolean,
  isError: boolean,
  granularityId: string,
): EventsPanel {
  if (isError) return { status: 'unavailable', points: [], total: null, revenue: null }
  if (isPending || data === undefined) {
    return { status: 'loading', points: [], total: null, revenue: null }
  }
  if (data.points.length === 0) {
    return { status: 'empty', points: [], total: null, revenue: null }
  }

  const format = granularityId === 'hourly' ? hourLabel : dayLabel

  return {
    status: 'ready',
    points: data.points.map((point) => ({
      label: format.format(point.timestamp),
      events: point.eventCount,
    })),
    total: data.eventCount,
    revenue: data.revenue,
  }
}

function toUsagePanel(
  data: UsageAnalytics | undefined,
  prior: UsageAnalytics | undefined,
  isPending: boolean,
  isError: boolean,
): UsagePanel {
  if (isError) return { status: 'unavailable', rows: [] }
  if (isPending || data === undefined) return { status: 'loading', rows: [] }
  if (data.features.length === 0) return { status: 'empty', rows: [] }

  const priorByFeature = new Map(prior?.features.map((row) => [row.featureId, row.usage]) ?? [])

  /*
   * Both the number and its rendering. The meter ranks features against each
   * other, so it needs `quantity` to measure with; `value` is the same figure
   * carrying its own unit, because "428K" alone is not an answer when the row
   * below it counts tokens.
   */
  const rows: UsageRow[] = data.features.slice(0, 5).map((feature) => ({
    featureId: feature.featureId,
    name: feature.name,
    lookupKey: feature.lookupKey,
    quantity: feature.usage,
    value: `${compact.format(feature.usage)} ${feature.unitPlural}`,
    changePercent: change(feature.usage, priorByFeature.get(feature.featureId) ?? 0),
  }))

  return { status: 'ready', rows }
}

function toSubscriptionsPanel(
  rows: Subscription[],
  windows: { current: { start: Date; end: Date }; prior: { start: Date; end: Date } },
  days: number,
  isPending: boolean,
  isError: boolean,
): SubscriptionsPanel {
  const blank: SubscriptionsPanel = {
    status: 'loading',
    total: 0,
    changePercent: null,
    days: [],
    plans: [],
  }
  if (isError) return { ...blank, status: 'unavailable' }
  if (isPending) return blank

  /** A subscription's own start date is what "new in this period" means. */
  const startedIn = (window: { start: Date; end: Date }) =>
    rows.filter((row) => {
      const at = row.startDate ?? row.createdAt
      return at !== null && at >= window.start && at < window.end
    })

  const current = startedIn(windows.current)
  if (current.length === 0) return { ...blank, status: 'empty' }

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
      const at = row.startDate ?? row.createdAt
      if (at === null || at < start || at >= end) continue
      if (!drawn.has(row.planName)) continue
      byPlan[row.planName] = (byPlan[row.planName] ?? 0) + 1
    }
    buckets.push({ label: bucketLabel(start, last), byPlan })
  }

  return {
    status: 'ready',
    total: current.length,
    changePercent: change(current.length, startedIn(windows.prior).length),
    days: buckets,
    plans,
  }
}

function toInvoicesPanel(
  rows: Invoice[],
  window: { start: Date; end: Date },
  isPending: boolean,
  isError: boolean,
): InvoicesPanel {
  const blank: InvoicesPanel = { status: 'loading', total: 0, paid: 0, open: 0, overdue: 0 }
  if (isError) return { ...blank, status: 'unavailable' }
  if (isPending) return blank

  // Issued inside the window — "finalized in the last 7 days", in the domain's
  // vocabulary. A draft has no issue date and is not finalized, so it is out.
  const issued = rows.filter(
    (row) => row.issuedAt !== null && row.issuedAt >= window.start && row.issuedAt < window.end,
  )
  if (issued.length === 0) return { ...blank, status: 'empty' }

  const count = (status: string) => issued.filter((row) => row.status === status).length

  return {
    status: 'ready',
    total: issued.length,
    paid: count(InvoiceStatus.Paid),
    open: count(InvoiceStatus.Open),
    overdue: count(InvoiceStatus.Overdue),
  }
}

function toApiPanel(
  keys: { status: string; lastUsedAt: Date | null; expiresAt: Date | null }[],
  isPending: boolean,
  isError: boolean,
): ApiPanel {
  if (isError) return { status: 'unavailable', activeKeys: 0, totalKeys: 0, lastUsedLabel: null }
  if (isPending) return { status: 'loading', activeKeys: 0, totalKeys: 0, lastUsedLabel: null }
  if (keys.length === 0) {
    return { status: 'empty', activeKeys: 0, totalKeys: 0, lastUsedLabel: null }
  }

  const lastUsed = keys
    .map((key) => key.lastUsedAt)
    .filter((at): at is Date => at !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return {
    status: 'ready',
    activeKeys: keys.filter((key) => isActive(key as never)).length,
    totalKeys: keys.length,
    lastUsedLabel: lastUsed !== undefined ? dayLabel.format(lastUsed) : null,
  }
}
