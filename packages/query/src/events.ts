import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import { money, type Money } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Usage analytics: the only time series this console can actually ask for.
 *
 * Everything else on the overview counts rows that already exist (invoices,
 * subscriptions, keys). This is the one endpoint that answers "how much came in
 * per day", and until now nothing in `@fp/query` reached it, so the Home page
 * showed invented numbers instead. `POST /events/analytics` has been in the SDK
 * the whole time (`client.events.getUsageAnalytics`); the gap was a hook, not a
 * capability.
 *
 * Two things this deliberately does **not** do:
 *
 *   - **No arithmetic on money.** `Money` has no `add` on purpose (see
 *     `@fp/domain/money`), so revenue is read from the server's own `subtotal`
 *     rather than summed here from line items. If the server does not send one,
 *     the panel says so instead of showing a number this file computed.
 *   - **No filling of gaps.** A window the server returned no point for stays
 *     absent. A chart that interpolates a missing day into a plausible-looking
 *     curve is exactly the failure the old sample-data dashboard was.
 *
 * Event counts and usage quantities *are* summed across features, because those
 * are plain counts of things: not currency: and the server returns them
 * per-feature with no combined series of its own.
 */

/** How wide each bucket in the series is. Mirrors the SDK's `WindowSize`. */
export const UsageWindowSize = {
  Hour: 'HOUR',
  Day: 'DAY',
  Week: 'WEEK',
} as const
export type UsageWindowSize = (typeof UsageWindowSize)[keyof typeof UsageWindowSize]

/** The period being asked about. Both ends are required: an open range is a different question. */
export interface UsageWindow {
  start: Date
  end: Date
}

/** One bucket of the series. */
export interface UsagePoint {
  timestamp: Date
  /** Events the server counted in this bucket. */
  eventCount: number
  /** Metered quantity in this bucket, in the feature's own unit. */
  usage: number
}

/** One metered feature's usage over the window. */
export interface FeatureUsageRow {
  featureId: string
  name: string
  /** The feature's `lookup_key`: what the design shows as `code.key`. */
  lookupKey: string
  unitPlural: string
  eventCount: number
  usage: number
  points: UsagePoint[]
  /** The meter behind the feature, to match its row in the cost analytics. */
  meterId: string
  /** What this feature's usage is billed at, after discounts. Null when the server did not price it. */
  revenue: Money | null
}

export interface UsageAnalytics {
  /** Events per bucket, summed across every feature. Empty when nothing was ingested. */
  points: UsagePoint[]
  /** Per-feature rows, busiest first. */
  features: FeatureUsageRow[]
  /** Total events in the window. */
  eventCount: number
  /**
   * What the server says this usage is worth.
   *
   * `null` when the response carried no `subtotal`: the panel renders that as
   * unavailable rather than as zero, because "the server did not price this"
   * and "this was worth nothing" are different claims.
   */
  revenue: Money | null
}

export interface UsageAnalyticsQuery {
  window: UsageWindow
  windowSize: UsageWindowSize
  /** Narrow to one customer. Omitted means the whole tenant. */
  externalCustomerId?: string | undefined
  /** Narrow to these features. Omitted or empty means every feature. */
  featureIds?: readonly string[] | undefined
  /** Add the usage of child customers linked through a subscription hierarchy. */
  includeChildren?: boolean | undefined
}

/**
 * The SDK's response, read structurally.
 *
 * Typed here rather than imported because every field on the generated model is
 * optional, and the mapper's job is precisely to decide what each absence means.
 */
interface AnalyticsPointWire {
  timestamp?: string | undefined
  eventCount?: number | undefined
  usage?: string | undefined
}

interface AnalyticsItemWire {
  featureId?: string | undefined
  meterId?: string | undefined
  totalCost?: string | undefined
  currency?: string | undefined
  eventName?: string | undefined
  eventCount?: number | undefined
  totalUsage?: string | undefined
  points?: AnalyticsPointWire[] | undefined
  feature?:
    | {
        id?: string | undefined
        name?: string | undefined
        lookupKey?: string | undefined
        lookup_key?: string | undefined
        unitPlural?: string | undefined
        unit_plural?: string | undefined
      }
    | undefined
}

interface AnalyticsResponseWire {
  items?: AnalyticsItemWire[] | undefined
  subtotal?: string | undefined
  currency?: string | undefined
}

/** A decimal string the server sent, as a number. Counts and quantities only: never money. */
function quantity(value: string | undefined): number {
  if (value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toPoint(wire: AnalyticsPointWire): UsagePoint | null {
  if (wire.timestamp === undefined) return null
  const timestamp = new Date(wire.timestamp)
  if (Number.isNaN(timestamp.getTime())) return null
  return {
    timestamp,
    eventCount: wire.eventCount ?? 0,
    usage: quantity(wire.usage),
  }
}

/** A server price as money, or null when there is none to show. */
function priced(amount: string | undefined, currency: string | undefined): Money | null {
  const code = currency?.trim() ?? ''
  return amount !== undefined && amount !== '' && code !== '' ? money(amount, code) : null
}

function toFeatureRow(wire: AnalyticsItemWire, currency?: string): FeatureUsageRow {
  const points = (wire.points ?? [])
    .map(toPoint)
    .filter((point): point is UsagePoint => point !== null)
  const feature = wire.feature
  const lookupKey = feature?.lookupKey ?? feature?.lookup_key ?? wire.eventName ?? ''

  return {
    featureId: wire.featureId ?? feature?.id ?? lookupKey,
    // Falls back through the shapes the server may answer with, and only then
    // to the lookup key: a row with no name at all is still a real row.
    name: feature?.name ?? wire.eventName ?? lookupKey,
    lookupKey,
    unitPlural: feature?.unitPlural ?? feature?.unit_plural ?? 'events',
    eventCount: wire.eventCount ?? 0,
    usage: quantity(wire.totalUsage),
    points,
    meterId: wire.meterId ?? '',
    // `total_cost` on an analytics item is what the usage bills at after
    // discounts: revenue, not what it costs to serve.
    revenue: priced(wire.totalCost, wire.currency || currency),
  }
}

/**
 * Collapse every feature's series into one series for the whole tenant.
 *
 * Keyed by the bucket's ISO timestamp so two features reporting the same day
 * land on the same point, and sorted by time because the server does not
 * promise an order and a chart reads left to right.
 */
function combineSeries(features: FeatureUsageRow[]): UsagePoint[] {
  const byTimestamp = new Map<number, UsagePoint>()

  for (const feature of features) {
    for (const point of feature.points) {
      const key = point.timestamp.getTime()
      const existing = byTimestamp.get(key)
      if (existing === undefined) {
        byTimestamp.set(key, { ...point })
        continue
      }
      existing.eventCount += point.eventCount
      existing.usage += point.usage
    }
  }

  return [...byTimestamp.values()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

export function toUsageAnalytics(wire: AnalyticsResponseWire): UsageAnalytics {
  const features = (wire.items ?? [])
    .map((item) => toFeatureRow(item, wire.currency))
    .sort((a, b) => b.usage - a.usage || b.eventCount - a.eventCount)

  const points = combineSeries(features)
  const eventCount = features.reduce((sum, feature) => sum + feature.eventCount, 0)

  // The server prices the window; this file does not. No subtotal, no revenue.
  // A blank currency is the same absence: Intl throws RangeError on "", and
  // that error is thrown during render, which replaces the whole route.
  const currency = wire.currency?.trim() ?? ''
  const revenue =
    wire.subtotal !== undefined && wire.subtotal !== '' && currency !== ''
      ? money(wire.subtotal, currency)
      : null

  return { points, features, eventCount, revenue }
}

async function fetchUsageAnalytics(
  client: Flexprice,
  query: UsageAnalyticsQuery,
): Promise<UsageAnalytics> {
  const response = (await call(() =>
    client.events.getUsageAnalytics({
      startTime: query.window.start,
      endTime: query.window.end,
      windowSize: query.windowSize as never,
      // `feature` is what carries the name and lookup key onto each row; without
      // it the usage panel can only show an id.
      expand: ['feature'],
      groupBy: ['feature_id'],
      ...(query.externalCustomerId !== undefined
        ? { externalCustomerId: query.externalCustomerId }
        : {}),
      ...(query.featureIds?.length ? { featureIds: [...query.featureIds] } : {}),
      ...(query.includeChildren ? { includeChildren: true } : {}),
    } as never),
  )) as AnalyticsResponseWire

  return toUsageAnalytics(response)
}

/** Everything the key needs to distinguish one window from another. */
function analyticsFilter(query: UsageAnalyticsQuery): Record<string, unknown> {
  return {
    start: query.window.start.toISOString(),
    end: query.window.end.toISOString(),
    windowSize: query.windowSize,
    customer: query.externalCustomerId ?? '',
    features: [...(query.featureIds ?? [])].sort(),
    children: query.includeChildren ?? false,
  }
}

/**
 * Usage analytics for one window.
 *
 * Call it twice: once for the period on screen, once for the period before it:
 * to show a change. That is two real measurements compared, which is a different
 * thing from a percentage a component made up.
 */
export function useUsageAnalytics(query: UsageAnalyticsQuery): UseQueryResult<UsageAnalytics> {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.events.analytics(analyticsFilter(query)),
    queryFn: () => fetchUsageAnalytics(client, query),
    // A dashboard that refetches a 90-day aggregation on every focus change is
    // a bill, not a feature.
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}
