import { useMemo, useState } from 'react'
import { DEFAULT_FEATURE_QUERY, FeatureType, formatMoney } from '@fp/domain'
import {
  useCustomerCostAnalytics,
  useFeatures,
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
export function CustomerAnalyticsPanel({ externalId }: { externalId: string }) {
  const [query, setQuery] = useState<AnalyticsQuery>(() => {
    const today = new Date()
    return {
      from: isoDay(new Date(today.getTime() - RANGE_DAYS * DAY)),
      to: isoDay(today),
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
  const filters = {
    window,
    externalCustomerId: externalId,
    featureIds,
    includeChildren: query.includeChildren,
  }
  const usage = useUsageAnalytics({ ...filters, windowSize: UsageWindowSize.Day })
  const costs = useCustomerCostAnalytics(filters)
  const metered = useFeatures({
    ...DEFAULT_FEATURE_QUERY,
    pageSize: 100,
    types: [FeatureType.Metered],
    // Archived features can still carry usage in the window.
    filters: [],
  })

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
      featureOptions={(metered.data?.features ?? [])
        .filter((feature) => feature.type === FeatureType.Metered)
        .map((feature) => ({ id: feature.id, name: feature.name }))}
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
      isLoading={usage.isPending}
      error={data ? null : usage.error ? 'Usage analytics could not be loaded.' : null}
      onRetry={() => {
        void usage.refetch()
        void costs.refetch()
      }}
    />
  )
}
