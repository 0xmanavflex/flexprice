import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { call } from '@fp/api'
import { money, type Money } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import type { UsageAnalyticsQuery } from './events'

/**
 * Revenue against cost for one customer: `POST /costs/analytics`
 * (`client.costs.getDetailedCostAnalytics`), what V1's Analytics tab reads for
 * its Revenue, Cost, Margin and Margin % figures.
 *
 * Cost comes from the environment's cost sheet: what each meter's usage costs
 * to serve. The server does the arithmetic; this only reads it. An absent
 * figure is `null`, shown as unavailable rather than as zero.
 */
export interface CostAnalytics {
  revenue: Money | null
  cost: Money | null
  margin: Money | null
  /** Margin as a percentage of revenue, e.g. `42.5`. */
  marginPercent: number | null
  /** What each meter's usage cost, keyed by meter id, to sit beside its feature. */
  costByMeter: Record<string, Money>
}

interface CostItemWire {
  meterId?: string | undefined
  totalCost?: string | undefined
  currency?: string | undefined
}

interface CostAnalyticsWire {
  currency?: string | undefined
  totalRevenue?: string | undefined
  totalCost?: string | undefined
  margin?: string | undefined
  marginPercent?: string | undefined
  costAnalytics?: CostItemWire[] | undefined
}

function priced(amount: string | undefined, currency: string): Money | null {
  return amount !== undefined && amount !== '' && currency !== '' ? money(amount, currency) : null
}

export function toCostAnalytics(wire: CostAnalyticsWire): CostAnalytics {
  const currency = wire.currency?.trim() ?? ''
  const percent = wire.marginPercent === undefined ? NaN : Number(wire.marginPercent)
  const costByMeter: Record<string, Money> = {}
  for (const item of wire.costAnalytics ?? []) {
    const cost = priced(item.totalCost, item.currency?.trim() || currency)
    if (item.meterId && cost) costByMeter[item.meterId] = cost
  }
  return {
    revenue: priced(wire.totalRevenue, currency),
    cost: priced(wire.totalCost, currency),
    margin: priced(wire.margin, currency),
    marginPercent: Number.isFinite(percent) ? percent : null,
    costByMeter,
  }
}

/** One customer's revenue, cost and margin over a window, on the same filters as their usage. */
export function useCustomerCostAnalytics(
  query: Omit<UsageAnalyticsQuery, 'windowSize'> & { externalCustomerId: string },
): UseQueryResult<CostAnalytics> {
  const client = useFlexprice()

  return useQuery({
    queryKey: [
      ...queryKeys.events.analytics({
        kind: 'cost',
        start: query.window.start.toISOString(),
        end: query.window.end.toISOString(),
        customer: query.externalCustomerId,
        features: [...(query.featureIds ?? [])].sort(),
        children: query.includeChildren ?? false,
      }),
    ],
    queryFn: async () =>
      toCostAnalytics(
        (await call(() =>
          client.costs.getDetailedCostAnalytics({
            startTime: query.window.start,
            endTime: query.window.end,
            externalCustomerId: query.externalCustomerId,
            ...(query.featureIds?.length ? { featureIds: [...query.featureIds] } : {}),
            ...(query.includeChildren ? { includeChildren: true } : {}),
          }),
        )) as CostAnalyticsWire,
      ),
    enabled: query.externalCustomerId.length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    // No cost sheet is a normal setup, not something to retry.
    retry: false,
  })
}
