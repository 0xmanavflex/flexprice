import { useMemo } from 'react'
import { formatMoney } from '@fp/domain'
import { useUsageAnalytics, UsageWindowSize } from '@fp/query'
import { CustomerUsageSummary } from '@fp/ui/pages'

const RANGE_DAYS = 30
const RANGE_LABEL = `Last ${RANGE_DAYS} days`

/**
 * A customer's Analytics tab: their usage analytics over the last 30 days, in
 * the four tiles and the per-feature table the console uses elsewhere.
 *
 * Rendered only for a customer with an external id — analytics are matched by
 * it, and without one the query would read the whole tenant.
 */
export function CustomerAnalyticsPanel({ externalId }: { externalId: string }) {
  // One window per mount: a fresh `Date` each render would change the query key and refetch forever.
  const window = useMemo(() => {
    const end = new Date()
    const start = new Date(end.getTime() - RANGE_DAYS * 86_400_000)
    return { start, end }
  }, [])
  const analytics = useUsageAnalytics({
    window,
    windowSize: UsageWindowSize.Day,
    externalCustomerId: externalId,
  })
  const data = analytics.data

  return (
    <CustomerUsageSummary
      rangeLabel={RANGE_LABEL}
      revenue={data?.revenue ? formatMoney(data.revenue) : null}
      eventCount={data?.eventCount ?? 0}
      rows={(data?.features ?? []).map((feature) => ({
        id: feature.featureId,
        name: feature.name,
        lookupKey: feature.lookupKey,
        eventCount: feature.eventCount,
        usage: `${new Intl.NumberFormat().format(feature.usage)}${feature.unitPlural ? ` ${feature.unitPlural}` : ''}`,
      }))}
      isLoading={analytics.isPending}
      error={data ? null : analytics.error ? 'Usage analytics could not be loaded.' : null}
      onRetry={() => void analytics.refetch()}
    />
  )
}
