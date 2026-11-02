import { useSubscriptionRevenue } from '@fp/query'
import { SubscriptionRevenue } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { toListFailure } from '@/pages/shared/listFailure'

/** A contract's Revenue tab: its revenue contract's obligations and revenue waterfall. */
export function SubscriptionRevenuePanel({ subscriptionId }: { subscriptionId: string }) {
  const { environmentId } = useSession()
  const revenue = useSubscriptionRevenue(environmentId, subscriptionId)
  const failure = toListFailure(revenue.error, 'revenue')
  return (
    <SubscriptionRevenue
      revenue={revenue.data}
      isLoading={revenue.isPending}
      error={failure?.message}
      onRetry={() => void revenue.refetch()}
    />
  )
}
