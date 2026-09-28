import { type SubscriptionQuery } from '@fp/domain'
import { ApiError, useSubscriptions } from '@fp/query'
import { SubscriptionFilters, SubscriptionGrid } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface SubscriptionListPageProps {
  query: SubscriptionQuery
  onQueryChange: (query: SubscriptionQuery) => void
  onCreate: () => void
}

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL, so a filtered list is a link.
 */
export function SubscriptionListPage({ query, onQueryChange, onCreate }: SubscriptionListPageProps) {
  const subscriptions = useSubscriptions(query)

  const failure = toFailure(subscriptions.error)
  const rows = subscriptions.data?.subscriptions ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Every active, paused and cancelled subscription."
        action={<Button onClick={onCreate}>New subscription</Button>}
      />

      <PageBody>
        <ListState
          isLoading={subscriptions.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void subscriptions.refetch()}
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
          createAction={<Button onClick={onCreate}>New subscription</Button>}
          emptyIcon={<RefreshCwIcon aria-hidden />}
          emptyTitle="No subscriptions yet"
          emptyDescription="A subscription puts a customer on a plan and starts their billing cycle."
        >
          <SubscriptionGrid
            subscriptions={rows}
            total={subscriptions.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            filters={
              <SubscriptionFilters
                statuses={query.statuses}
                onStatusesChange={(statuses) => onQueryChange({ ...query, statuses, page: 1 })}
              />
            }
          />
        </ListState>
      </PageBody>
    </>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to subscriptions here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading subscriptions.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading subscriptions.', canRetry: true }
}
