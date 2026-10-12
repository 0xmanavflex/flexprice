import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useInvoices, useSubscriptions } from '@fp/query'
import { DEFAULT_INVOICE_QUERY, DEFAULT_SUBSCRIPTION_QUERY, InvoiceStatus } from '@fp/domain'
import type { Invoice, Subscription } from '@fp/domain'
import { DashboardHome } from '@fp/ui/pages'
import { failed, qualityOf, withoutData } from './queryView'
import type { QueryView } from './queryView'
import type {
  AttentionItem,
  AttentionPanel,
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
 * Three panels are read from live queries:
 *
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

/** Midnight UTC `daysAgo` days back — the boundary every window is cut on. */
function dayStart(daysAgo: number): Date {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

/*
 * Every label is cut in UTC, because every window is: `dayStart` buckets on
 * midnight UTC, so a label in the browser's zone would put a bucket's rows
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

  const range = RANGES.find((entry) => entry.id === rangeId) ?? RANGES[0]!

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
  // Draft is an API status, so the server counts it exactly. Overdue is derived from a due date
  // and cannot be asked for, so it is read off the invoices already fetched above.
  const draftInvoices = useInvoices({ ...ATTENTION_QUERY, statuses: [InvoiceStatus.Draft] })
  // Parked with the API panel until quota-based metrics land.
  // const apiKeys = useApiKeys()

  /*
   * Parked until quota-based metrics land, with the usage queries it reads
   * (`useUsageAnalytics` for the window and the one before it).
   *
   * const usagePanel = toUsagePanel(analytics.data, priorAnalytics.data, analytics.isPending, analytics.isError)
   */

  const subscriptionsPanel = toSubscriptionsPanel(subscriptions, windows, range.days)
  const invoicesPanel = toInvoicesPanel(invoices, windows)

  /*
   * Parked until quota-based metrics land.
   *
   * const apiPanel = toApiPanel(apiKeys.data?.keys ?? [], apiKeys.isPending, apiKeys.isError)
   */

  const attentionPanel = toAttentionPanel(invoices, draftInvoices)

  return (
    <DashboardHome
      rangeOptions={RANGES.map(({ id, label }) => ({ id, label }))}
      range={rangeId}
      onRangeChange={setRangeId}
      rangeLabel={range.label.toLowerCase()}
      subscriptions={subscriptionsPanel}
      invoices={invoicesPanel}
      attention={attentionPanel}
      onNavigate={(path) => {
        // A task links to a filtered list, so the query string rides along.
        const [to = path, query = ''] = path.split('?')
        void navigate({ to, search: Object.fromEntries(new URLSearchParams(query)) as never })
      }}
    />
  )
}

/* ---- Shaping the panels -------------------------------------------------- */

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

const ATTENTION_QUERY = { ...DEFAULT_INVOICE_QUERY, pageSize: 3 }

type InvoiceRows = QueryView<{ invoices: Invoice[]; total: number }>

/** "Acme, Globex and 2 more" — who the records belong to, from the few rows read. */
function whoseInvoices(rows: Invoice[], total: number): string | undefined {
  const names = [...new Set(rows.map((row) => row.customerName))].slice(0, 3)
  if (names.length === 0) return undefined
  const rest = total - names.length
  return rest > 0 ? `${names.join(', ')} and ${rest} more` : names.join(', ')
}

const plural = (count: number, noun: string) =>
  `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`

/**
 * One row per kind of task that has records, most urgent first.
 *
 * Empty only when every source answered and found nothing. A source that has
 * no data yet cannot rule a task out, so the list is never declared empty on
 * the strength of a request that failed or has not finished: with rows from the
 * other source they stay (marked stale if one failed), otherwise the panel is
 * loading or unavailable.
 */
function toAttentionPanel(recent: InvoiceRows, drafts: InvoiceRows): AttentionPanel {
  const sources = [recent, drafts]
  const missing = sources.filter((source) => source.data === undefined)
  const broken = sources.filter(failed)

  const items: AttentionItem[] = []

  const loaded = recent.data?.invoices ?? []
  const overdue = loaded.filter((row) => row.status === InvoiceStatus.Overdue)
  // Overdue is derived client-side, so it is only known for the page read.
  const recentTruncated = recent.data !== undefined && recent.data.total > loaded.length
  if (overdue.length > 0) {
    const who = whoseInvoices(overdue, overdue.length)
    items.push({
      id: 'overdue',
      title: plural(overdue.length, 'overdue invoice'),
      detail: [who, recentTruncated ? `among the latest ${loaded.length}` : undefined]
        .filter(Boolean)
        .join(' · '),
      tone: 'critical',
      path: `/invoices?status=${InvoiceStatus.Overdue}`,
    })
  }

  const draftTotal = drafts.data?.total ?? 0
  if (draftTotal > 0) {
    items.push({
      id: 'draft',
      title: plural(draftTotal, 'draft invoice'),
      detail: whoseInvoices(drafts.data?.invoices ?? [], draftTotal),
      tone: 'neutral',
      path: `/invoices?status=${InvoiceStatus.Draft}`,
    })
  }

  /*
   * "Nothing overdue" is only a claim about the newest page. When older
   * invoices exist, say what was checked rather than leave the list empty.
   */
  if (overdue.length === 0 && recentTruncated) {
    items.push({
      id: 'overdue-checked',
      title: `No overdue invoices among the latest ${loaded.length}`,
      detail: 'Older invoices were not checked',
      tone: 'neutral',
      path: `/invoices?status=${InvoiceStatus.Overdue}`,
    })
  }

  const retry = () => {
    for (const source of broken.length > 0 ? broken : sources) void source.refetch()
  }
  const meta = {
    onRetry: retry,
    isRetrying: sources.some((source) => source.isFetching),
  }

  if (missing.length > 0 && items.length === 0) {
    return {
      ...meta,
      status: broken.some((source) => source.data === undefined) ? 'unavailable' : 'loading',
      items: [],
    }
  }

  return {
    ...meta,
    status: 'ready',
    items,
    stale: broken.length > 0,
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
