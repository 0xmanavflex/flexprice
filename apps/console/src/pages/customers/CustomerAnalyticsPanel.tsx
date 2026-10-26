import { useMemo, useState } from 'react'
import { DEFAULT_FEATURE_QUERY, FeatureType, formatMoney } from '@fp/domain'
import {
  useCustomerCostAnalytics,
  useFeatures,
  useFeaturesByMeters,
  useUsageAnalytics,
  UsageWindowSize,
} from '@fp/query'
import { CustomerAnalyticsView, type AnalyticsQuery } from '@fp/ui/pages'

const RANGE_DAYS = 30
const DAY = 86_400_000

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const grouped = new Intl.NumberFormat()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

/**
 * A customer's Analytics tab, on the redesign's layout, with real data.
 *
 * Two reads on the same filters (features, date range, child customers):
 * - usage analytics (`/events/usage/analytics`): each feature's usage, its
 *   revenue and its daily series;
 * - cost analytics (`/costs/analytics`): revenue, cost, margin and margin %
 *   from the cost sheet, and each meter's cost.
 *
 * Without a cost sheet the cost read fails or comes back empty; cost and
 * margin then read "—" and revenue falls back to the usage read's own total.
 *
 * Rendered only for a customer with an external id: analytics are matched by
 * it, and without one the query would read the whole tenant.
 */
export function CustomerAnalyticsPanel({
  externalId,
  scope,
}: {
  externalId: string
  /**
   * Narrows the panel to part of the customer: a contract's metered charges
   * (by meter), opening on its period, with a note saying what is covered.
   */
  scope?:
    | {
        meterIds: readonly string[]
        from?: string | undefined
        to?: string | undefined
        note: string
      }
    | undefined
}) {
  const [query, setQuery] = useState<AnalyticsQuery>(() => {
    const today = new Date()
    return {
      from: scope?.from ?? isoDay(new Date(today.getTime() - RANGE_DAYS * DAY)),
      to: scope?.to ?? isoDay(today),
      includeChildren: false,
    }
  })
  const [featureIds, setFeatureIds] = useState<string[]>([])

  // The range as instants: the whole of the first day to the end of the last.
  const window = useMemo(
    () => ({
      start: new Date(`${query.from}T00:00:00`),
      end: new Date(`${query.to}T23:59:59.999`),
    }),
    [query.from, query.to],
  )
  const metered = useFeatures(
    {
      ...DEFAULT_FEATURE_QUERY,
      pageSize: 100,
      types: [FeatureType.Metered],
      // Archived features can still carry usage in the window.
      filters: [],
    },
    { enabled: !scope },
  )
  // A scope's features are searched by its meters, so none is missed for
  // sitting past the first page of the catalogue.
  const scoped = useFeaturesByMeters(scope?.meterIds ?? [])
  const catalogue = scope ? scoped : metered
  // The features on offer: every metered one, or only those a scope names.
  const options = (scope ? (scoped.data ?? []) : (metered.data?.features ?? [])).filter(
    (feature) =>
      feature.type === FeatureType.Metered &&
      (!scope || (feature.meterId !== null && scope.meterIds.includes(feature.meterId))),
  )
  // With a scope, "all" means all of its features, never the whole customer;
  // a scope with none matches nothing rather than everything.
  const scopedIds = options.map((feature) => feature.id)
  const effectiveIds =
    featureIds.length > 0 || !scope ? featureIds : scopedIds.length > 0 ? scopedIds : ['none']
  const filters = {
    window,
    externalCustomerId: externalId,
    featureIds: effectiveIds,
    includeChildren: query.includeChildren,
  }
  // A scope waits for its features: until then "none" would read as no usage.
  const ready = !scope || scoped.isSuccess
  const usage = useUsageAnalytics(
    { ...filters, windowSize: UsageWindowSize.Day },
    { enabled: ready },
  )
  const costs = useCustomerCostAnalytics(filters, { enabled: ready })

  const data = usage.data
  const cost = costs.data
  const rows = data?.features ?? []
  // Share is a ratio of the server's own amounts; nothing here is summed as money.
  const revenueOf = (amount: string | undefined) => (amount ? Number(amount) : 0)
  const totalRevenue = rows.reduce((sum, row) => sum + revenueOf(row.revenue?.amount), 0)

  const revenue = cost?.revenue ?? data?.revenue ?? null

  return (
    <CustomerAnalyticsView
      query={query}
      onQueryChange={setQuery}
      featureOptions={options.map((feature) => ({ id: feature.id, name: feature.name }))}
      {...(scope ? { note: scope.note } : {})}
      selectedFeatureIds={featureIds}
      onSelectedFeatureIdsChange={setFeatureIds}
      totals={{
        revenue: revenue ? formatMoney(revenue) : null,
        cost: cost?.cost ? formatMoney(cost.cost) : null,
        margin: cost?.margin ? formatMoney(cost.margin) : null,
        marginPercent:
          cost?.marginPercent != null && cost.cost ? `${cost.marginPercent.toFixed(1)}%` : null,
      }}
      features={rows.map((row) => {
        const meterCost = row.meterId ? cost?.costByMeter[row.meterId] : undefined
        return {
          id: row.featureId,
          name: row.name,
          usage: grouped.format(row.usage),
          short: compact.format(row.usage),
          unit: row.unitPlural,
          revenue: row.revenue ? formatMoney(row.revenue) : null,
          share: totalRevenue > 0 ? revenueOf(row.revenue?.amount) / totalRevenue : 0,
          cost: meterCost ? formatMoney(meterCost) : null,
          points: row.points.map((point) => ({
            label: dayLabel.format(point.timestamp),
            value: point.usage,
          })),
        }
      })}
      isLoading={catalogue.isPending || usage.isPending}
      error={
        catalogue.isError
          ? 'The features could not be loaded.'
          : data
            ? null
            : usage.error
              ? 'Usage analytics could not be loaded.'
              : null
      }
      onRetry={() => {
        if (catalogue.isError) void catalogue.refetch()
        void usage.refetch()
        void costs.refetch()
      }}
    />
  )
}
