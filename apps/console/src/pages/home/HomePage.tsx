import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { HomeSearch } from '@/app/homeSearch'
import {
  reportBreakdown,
  reportCurrencies,
  reportScalar,
  reportSeries,
  reportsUnconfigured,
  useInvoices,
  useRevenueOverview,
  useReport,
  useSubscriptions,
  useUsageAnalytics,
  UsageWindowSize,
} from '@fp/query'
import type { ReportQuery, ReportResult, RevenueOverview, UsageAnalytics } from '@fp/query'
import { DEFAULT_INVOICE_QUERY, DEFAULT_SUBSCRIPTION_QUERY, InvoiceStatus, money } from '@fp/domain'
import type { Invoice, Money, Subscription } from '@fp/domain'
import { CUSTOM_RANGE_ID, DashboardHome } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { useOnboardingGate } from '@/app/onboarding/useOnboardingGate'
import { qualityOf, withoutData } from './queryView'
import type { QueryView } from './queryView'
import type {
  DayRange,
  EventsPanel,
  FilterOption,
  InvoicesPanel,
  RevenuePanel,
  SubscriptionsPanel,
} from '@fp/ui/pages'

/**
 * Home: the console overview, wired to what the API can actually answer.
 *
 * This file is where the honesty of the surface is decided. `DashboardHome` is
 * presentational; it renders whatever panel status it is handed. Choosing that
 * status: ready, empty, or unavailable: is this component's whole job, and
 * the rule it follows is that a number reaches the screen only if a request
 * returned it.
 *
 * Four panels are read from live queries:
 *
 *   - **Revenue** from the report library's `invoice_total`.
 *   - **Usage ingestion** from usage analytics (`POST /events/analytics`)
 *     over the whole window at the chosen granularity. When that returns
 *     nothing, the `events_volume` report fills it, which covers at most the
 *     last seven days and says so.
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

// Failed cards show unavailable.
const useCardReport = (key: string, query: ReportQuery | null) => useReport(key, query)

interface RangeSpec extends FilterOption {
  days: number
}

const RANGES: RangeSpec[] = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '14d', label: 'Last 14 days', days: 14 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: '180d', label: 'Last 6 months', days: 180 },
  { id: '365d', label: 'Last 12 months', days: 365 },
]

/** The presets plus "Custom range", which opens the date picker. */
const RANGE_OPTIONS: FilterOption[] = [
  ...RANGES.map(({ id, label }) => ({ id, label })),
  { id: CUSTOM_RANGE_ID, label: 'Custom range' },
]

/** Hourly buckets stop being readable (and cheap) past a month. */
const MAX_HOURLY_DAYS = 31

const GRANULARITIES: (FilterOption & { windowSize: UsageWindowSize })[] = [
  { id: 'hourly', label: 'Hourly', windowSize: UsageWindowSize.Hour },
  { id: 'daily', label: 'Daily', windowSize: UsageWindowSize.Day },
  { id: 'weekly', label: 'Weekly', windowSize: UsageWindowSize.Week },
]

function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** A picked calendar day as midnight UTC, so a custom window is cut like a preset one. */
function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

const pickedDay = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Midnight UTC `daysAgo` days back: the boundary every window is cut on. */
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
 * Its columns are narrow: seven of them share the half-width panel: and
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
 * Growth from zero is not a percentage: it is "the first one": and printing
 * `+100%` or `+∞%` for it is the kind of confident nonsense this surface exists
 * to avoid.
 */
function change(current: number, prior: number): number | null {
  if (prior <= 0) return null
  return ((current - prior) / prior) * 100
}

export function HomePage({
  search,
  onSearchChange,
}: {
  search: HomeSearch
  onSearchChange: (next: HomeSearch) => void
}) {
  // A tenant that has not answered the onboarding questions answers them first.
  useOnboardingGate()
  const navigate = useNavigate()
  const { environmentId } = useSession()
  const rangeId = search.range
  const granularityId = search.grain
  // Seeded once, so a custom range with no dates in the URL stays put.
  const [customFallback] = useState<DayRange>(() => ({
    from: new Date(Date.now() - 29 * DAY_MS),
    to: new Date(),
  }))
  const custom = useMemo<DayRange>(
    () => ({
      from: parseDay(search.from) ?? customFallback.from,
      to: parseDay(search.to) ?? customFallback.to,
    }),
    [search.from, search.to, customFallback],
  )
  // Choosing Custom writes the span it shows into the URL, so the link names
  // one window rather than "the 30 days before whenever it is opened".
  const setRangeId = (range: string) =>
    onSearchChange(
      range === CUSTOM_RANGE_ID
        ? { ...search, range, from: formatDay(custom.from), to: formatDay(custom.to) }
        : { ...search, range },
    )
  const setGranularityId = (grain: string) => onSearchChange({ ...search, grain })
  const setCustom = (next: DayRange) =>
    onSearchChange({
      ...search,
      range: CUSTOM_RANGE_ID,
      from: formatDay(next.from),
      to: formatDay(next.to),
    })
  const isCustom = rangeId === CUSTOM_RANGE_ID

  /*
   * Both windows are derived from one `now` per render pass, so the current and
   * prior windows are exactly adjacent and the same width. Two independent
   * `Date.now()` calls would leave a sliver of time in neither.
   */
  const windows = useMemo<Windows>(() => {
    if (isCustom) {
      // Both picked days are inclusive: the window runs to the end of the last one,
      // or to now when that is today.
      const start = utcDay(custom.from)
      const end = new Date(Math.min(utcDay(custom.to).getTime() + DAY_MS, Date.now()))
      const days = Math.max(
        1,
        Math.round((utcDay(custom.to).getTime() - start.getTime()) / DAY_MS) + 1,
      )
      const priorStart = new Date(start.getTime() - days * DAY_MS)
      return { current: { start, end }, prior: { start: priorStart, end: start }, days }
    }
    const preset = RANGES.find((entry) => entry.id === rangeId) ?? RANGES[0]!
    const end = new Date()
    const start = dayStart(preset.days)
    const priorStart = new Date(start.getTime() - preset.days * DAY_MS)
    return {
      current: { start, end },
      prior: { start: priorStart, end: start },
      days: preset.days,
    }
  }, [isCustom, custom, rangeId])
  const days = windows.days
  const rangeLabel = isCustom
    ? `${pickedDay.formatRange(custom.from, custom.to)}`
    : (RANGES.find((entry) => entry.id === rangeId) ?? RANGES[0]!).label.toLowerCase()

  const granularityOptions = GRANULARITIES.filter(
    (entry) => entry.id !== 'hourly' || days <= MAX_HOURLY_DAYS,
  )
  const granularity =
    granularityOptions.find((entry) => entry.id === granularityId) ?? GRANULARITIES[1]!

  /*
   * Usage is read first from usage analytics, which gives a line over the
   * whole window. The events report is the fallback when that comes back
   * empty or fails, so the panel is never blank while one source has data.
   */
  const analytics = useUsageAnalytics({
    window: windows.current,
    windowSize: granularity.windowSize,
  })
  // The window before this one, so the change is two real measurements compared.
  const priorAnalytics = useUsageAnalytics({
    window: windows.prior,
    windowSize: UsageWindowSize.Day,
  })

  // The events report refuses a range longer than a week, so the chart is the
  // last seven days of the selected window, and the week before it for the change.
  const eventsEnd = windows.current.end
  const eventsStart = new Date(
    Math.max(windows.current.start.getTime(), eventsEnd.getTime() - 6 * DAY_MS),
  )
  const priorEventsEnd = eventsStart
  const priorEventsStart = new Date(priorEventsEnd.getTime() - 7 * DAY_MS)
  const eventsReport = useCardReport('events_volume', {
    shape: 'timeseries',
    range: reportRange({ start: eventsStart, end: eventsEnd }),
    grain: 'day',
  })
  const priorEventsReport = useCardReport('events_volume', {
    shape: 'timeseries',
    range: reportRange({ start: priorEventsStart, end: priorEventsEnd }),
    grain: 'day',
  })

  /*
   * A page large enough that every row inside the window is on it. Sorted
   * newest-first by the server, so once the rows fall out of the window the
   * rest are older still: which is what makes counting them here exact rather
   * than a sample. When the page is full and still inside the window, the
   * panel says so (`basedOn`) instead of presenting a floor as a total.
   */
  const subscriptions = useSubscriptions({
    ...DEFAULT_SUBSCRIPTION_QUERY,
    // Every contract, not the list's Active and Trialing default.
    filters: [],
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

  /*
   * Revenue: the report library's `invoice_total` (finalized invoices by
   * finalization date), as on Reports: the total and its change against the
   * window before, by day for the chart, and by customer for the leaders.
   * Every currency first, for the headline and so the chart can draw one line each.
   */
  const range = reportRange(windows.current)
  const revenueAll = useCardReport('invoice_total', {
    shape: 'scalar',
    range,
    compare: 'previous_period',
  })
  const mainCurrency = largestCurrency(revenueAll.data)
  const revenueByDay = useCardReport('invoice_total', {
    shape: 'timeseries',
    range,
    grain: 'day',
  })
  const revenueByCustomer = useCardReport(
    'invoice_total',
    mainCurrency
      ? {
          shape: 'breakdown',
          range,
          dimensions: ['customer_id'],
          currency: mainCurrency.toLowerCase(),
          limit: TOP_CUSTOMERS,
        }
      : null,
  )
  const billed = useRevenueOverview(environmentId, windows.current)
  const leaderNames = Object.fromEntries(
    (billed.data?.customers ?? []).map((row) => [row.customerId, row.name]),
  )

  const eventsPanel = preferred(
    eventsFromAnalytics(analytics, priorAnalytics, granularity.id),
    eventsFromReport(
      eventsReport,
      priorEventsReport,
      eventsStart.getTime() > windows.current.start.getTime(),
    ),
  )
  const revenuePanel = reportsUnconfigured(revenueAll.error)
    ? revenueFromDashboard(billed)
    : toRevenuePanel(
        revenueAll,
        revenueByDay,
        revenueByCustomer.data,
        leaderNames,
        windows,
        granularity.id,
      )
  /*
   * Parked until quota-based metrics land.
   *
   * const usagePanel = toUsagePanel(analytics.data, priorAnalytics.data, analytics.isPending, analytics.isError)
   */

  const subscriptionsPanel = toSubscriptionsPanel(subscriptions, windows)
  const invoicesPanel = toInvoicesPanel(invoices, windows)

  return (
    <DashboardHome
      rangeOptions={RANGE_OPTIONS}
      range={rangeId}
      onRangeChange={setRangeId}
      customRange={{ value: custom, onChange: setCustom }}
      granularityOptions={granularityOptions.map(({ id, label }) => ({ id, label }))}
      granularity={granularity.id}
      onGranularityChange={setGranularityId}
      metric={search.metric}
      onMetricChange={(metric) => onSearchChange({ ...search, metric })}
      rangeLabel={rangeLabel}
      events={eventsPanel}
      revenue={revenuePanel}
      subscriptions={subscriptionsPanel}
      invoices={invoicesPanel}
      onNavigate={(path) => void navigate({ to: path, search: {} as never })}
    />
  )
}

/* ---- Shaping the panels -------------------------------------------------- */

/**
 * The primary panel, unless it has nothing to show (empty, or its read failed)
 * and the fallback has: then the fallback, which says what it is based on.
 */
function preferred<P extends { status: string }>(primary: P, fallback: P): P {
  if (primary.status === 'ready' || primary.status === 'loading') return primary
  return fallback.status === 'ready' || fallback.status === 'loading' ? fallback : primary
}

const hourLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', timeZone: 'UTC' })

/** Usage over the whole window from usage analytics, at the chosen granularity. */
function eventsFromAnalytics(
  view: QueryView<UsageAnalytics>,
  prior: QueryView<UsageAnalytics>,
  granularityId: string,
): EventsPanel {
  const meta = qualityOf(view)
  const data = view.data
  if (data === undefined) {
    return { ...meta, status: withoutData(view), points: [], total: null, revenue: null }
  }
  if (data.points.length === 0 || data.eventCount === 0) {
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

function revenueChange(current: Money | null, prior: Money | null): number | null {
  if (current === null || prior === null || current.currency !== prior.currency) return null
  return change(Number(current.amount), Number(prior.amount))
}

/** Usage from the events report: the fallback, at most the last seven days. */
function eventsFromReport(
  view: QueryView<ReportResult>,
  prior: QueryView<ReportResult>,
  limited: boolean,
): EventsPanel {
  const meta = qualityOf(view)
  const points = reportSeries(view.data, 'events_volume')
  if (view.data === undefined) {
    return { ...meta, status: withoutData(view), points: [], total: null, revenue: null }
  }
  if (points.length === 0) {
    return { ...meta, status: 'empty', points: [], total: null, revenue: null }
  }

  const total = points.reduce((sum, point) => sum + point.value, 0)
  const priorPoints =
    prior.data !== undefined && !prior.isPlaceholderData
      ? reportSeries(prior.data, 'events_volume')
      : undefined
  const priorTotal = priorPoints?.reduce((sum, point) => sum + point.value, 0)

  return {
    ...meta,
    status: 'ready',
    ...(limited ? { basedOn: 'The last 7 days. The events report covers at most a week.' } : {}),
    points: points.map((point) => ({
      label: dayLabel.format(point.bucket),
      events: point.value,
    })),
    total,
    revenue: null,
    totalChangePercent:
      priorTotal === undefined || view.isPlaceholderData ? null : change(total, priorTotal),
    revenueChangePercent: null,
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

/** Customers listed under "Top customers by revenue". */
const TOP_CUSTOMERS = 5

/**
 * The invoiced-revenue panel. The headline currency is the one invoiced to the
 * most customers; any others are named, never added in.
 */
/** The window as the report library's range: `from..to`, both whole UTC days, `to` exclusive. */
function reportRange(window: { start: Date; end: Date }): string {
  const day = (date: Date) => date.toISOString().slice(0, 10)
  const end = new Date(window.end)
  // A window that ends mid-day (a preset runs to now) includes that day.
  if (end.getUTCHours() || end.getUTCMinutes() || end.getUTCSeconds() || end.getUTCMilliseconds()) {
    end.setUTCHours(24, 0, 0, 0)
  }
  return `${day(window.start)}..${day(end)}`
}

/** The currency the report billed most in, upper case; null before it answers or when empty. */
function largestCurrency(result: ReportResult | undefined): string | null {
  let best: { currency: string; value: number } | null = null
  for (const currency of reportCurrencies(result)) {
    const value = reportScalar(result, 'invoice_total', currency).value ?? 0
    if (value > 0 && (best === null || value > best.value)) best = { currency, value }
  }
  return best?.currency ?? null
}

/** Revenue from `POST /dashboard/revenue-dashboard` when the report library is not configured. */
function revenueFromDashboard(view: QueryView<RevenueOverview>): RevenuePanel {
  const meta = qualityOf(view)
  const blank = {
    total: null,
    fixed: null,
    usage: null,
    points: [],
    hideChart: true,
    topCustomers: [],
    otherCurrencies: [],
  }
  if (!view.data) return { ...meta, ...blank, status: withoutData(view) }
  const summary = view.data.summaries[0]
  if (!summary) return { ...meta, ...blank, status: 'empty' }
  const currency = summary.currency
  return {
    ...meta,
    status: 'ready',
    total: summary.total,
    fixed: summary.fixed,
    usage: summary.usage,
    changePercent: null,
    points: [],
    hideChart: true,
    topCustomers: view.data.customers
      .filter((row) => row.total.currency === currency)
      .slice(0, TOP_CUSTOMERS)
      .map((row) => ({ id: row.customerId, name: row.name, total: row.total })),
    otherCurrencies: view.data.summaries.slice(1).map((row) => row.currency),
  }
}

function toRevenuePanel(
  view: QueryView<ReportResult>,
  byDay: QueryView<ReportResult>,
  byCustomer: ReportResult | undefined,
  names: Record<string, string>,
  windows: Windows,
  granularityId: string,
): RevenuePanel {
  const source = view.data === undefined ? view : byDay.data === undefined ? byDay : view
  const meta = qualityOf(source)
  const blank = {
    total: null,
    fixed: null,
    usage: null,
    points: [],
    topCustomers: [],
    otherCurrencies: [],
  }
  if (view.data === undefined) return { ...meta, ...blank, status: withoutData(view) }
  // The chart is its own request. A failure there is "revenue could not be
  // loaded", not a flat zero line, and not a dead page.
  if (byDay.data === undefined) return { ...meta, ...blank, status: withoutData(byDay) }
  const main = largestCurrency(view.data)
  if (!main) return { ...meta, ...blank, status: 'empty' }

  const totalOf = (currency: string) => reportScalar(view.data, 'invoice_total', currency)
  const headline = totalOf(main)
  const asMoney = (value: number, currency: string) => money(value.toFixed(2), currency)

  return {
    ...meta,
    status: 'ready',
    total: asMoney(headline.value ?? 0, main),
    fixed: null,
    usage: null,
    changePercent: headline.change === null ? null : headline.change * 100,
    points: revenuePoints(byDay.data, reportCurrencies(view.data), main, windows, granularityId),
    series: reportCurrencies(view.data).map((currency) => ({ id: currency, label: currency })),
    topCustomers: reportBreakdown(byCustomer, 'invoice_total', ['customer_id'], main)
      .filter((row) => row.value > 0)
      .slice(0, TOP_CUSTOMERS)
      .map((row) => {
        const id = row.keys['customer_id'] ?? ''
        return { id, name: names[id] ?? id, total: asMoney(row.value, main) }
      }),
    otherCurrencies: reportCurrencies(view.data).filter(
      (currency) => currency !== main && (totalOf(currency).value ?? 0) > 0,
    ),
  }
}

/**
 * The report's days as chart points: one per UTC day of the window (a quiet
 * day is a zero, not a gap), or one per week under the weekly granularity.
 * Hourly reads as daily: an invoice total has no meaningful hour.
 */
function revenuePoints(
  result: ReportResult | undefined,
  currencies: string[],
  main: string,
  windows: Windows,
  granularityId: string,
): { label: string; value: number; extra: Record<string, number> }[] {
  const byCurrency = new Map(
    currencies.map((currency) => [
      currency,
      new Map(
        reportSeries(result, 'invoice_total', currency).map((point) => [
          point.bucket.toISOString().slice(0, 10),
          point.value,
        ]),
      ),
    ]),
  )
  const step = granularityId === 'weekly' ? 7 : 1
  const span = spanDays(windows)
  const points: { label: string; value: number; extra: Record<string, number> }[] = []
  for (let index = 0; index < span; index += step) {
    const extra: Record<string, number> = {}
    for (const currency of currencies) {
      let value = 0
      for (let offset = index; offset < Math.min(index + step, span); offset += 1) {
        value +=
          byCurrency.get(currency)?.get(windowDay(windows, offset).toISOString().slice(0, 10)) ?? 0
      }
      extra[currency] = value
    }
    points.push({
      label: dayLabel.format(windowDay(windows, index)),
      value: extra[main] ?? 0,
      extra,
    })
  }
  return points
}

interface Windows {
  current: { start: Date; end: Date }
  prior: { start: Date; end: Date }
  /** Whole days in the current window. */
  days: number
}

/** Calendar days the current window touches: a preset's runs to now, so it includes today. */
function spanDays(windows: Windows): number {
  return Math.max(
    1,
    Math.ceil((windows.current.end.getTime() - windows.current.start.getTime()) / DAY_MS),
  )
}

/** The UTC day `index` days after the window's first one. */
function windowDay(windows: Windows, index: number): Date {
  return new Date(windows.current.start.getTime() + index * DAY_MS)
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
   * mark by design: ninety of them would be slivers, and the gaps alone would
   * be wider than the panel. So a long window is bucketed rather than
   * truncated: every subscription inside it is still counted, in a column that
   * spans several days and says so on the axis.
   */
  const bucketDays = Math.max(1, Math.ceil(spanDays(windows) / MAX_COLUMNS))
  const buckets: { label: string; byPlan: Record<string, number> }[] = []
  const span = spanDays(windows)
  for (let index = 0; index < span; index += bucketDays) {
    const start = windowDay(windows, index)
    const last = windowDay(windows, Math.min(index + bucketDays, span) - 1)
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
  // Issued inside the window: "finalized in the last 7 days", in the domain's
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
