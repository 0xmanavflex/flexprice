import { DEFAULT_CUSTOMER_QUERY, DEFAULT_PLAN_QUERY, type SubscriptionQuery } from '@fp/domain'
import { useCustomers, usePlans, useSubscriptions } from '@fp/query'
import { SubscriptionGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface SubscriptionListPageProps {
  query: SubscriptionQuery
  onQueryChange: (query: SubscriptionQuery) => void
  onCreate: () => void
  onOpen?: (subscriptionId: string) => void
  onOpenCustomer?: (customerId: string) => void
  onOpenPlan?: (planId: string) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL, so a filtered list is a link.
 */
export function SubscriptionListPage({
  query,
  onQueryChange,
  onCreate,
  onOpen,
  onOpenCustomer,
  onOpenPlan,
}: SubscriptionListPageProps) {
  const subscriptions = useSubscriptions(query)
  // The choices behind the Customer and Plan filters: the first hundred of each,
  // the same picker page the create form uses.
  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, page: 1, pageSize: 100 })
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, page: 1, pageSize: 100 })
  const filterOptions = {
    customer_id: (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name })),
    plan_id: (plans.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name })),
  }

  const failure = toListFailure(subscriptions.error, 'contracts')
  const rows = subscriptions.data?.subscriptions ?? []
  const isFiltered =
    query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0

  return (
    <>
      <PageBody>
        <ListState
          isLoading={subscriptions.isPending}
          error={failure}
          isEmpty={rows.length === 0 && (subscriptions.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={subscriptions.isFetching && !subscriptions.isPending}
          isProvisional={subscriptions.isPlaceholderData}
          isRetrying={subscriptions.isFetching && subscriptions.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          isFiltered={isFiltered}
          onRetry={() => void subscriptions.refetch()}
          onClearFilters={() =>
            onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })
          }
          createAction={<Button onClick={onCreate}>New contract</Button>}
          emptyTitle="No contracts yet"
          emptyDescription="A contract puts a customer on a plan and starts their billing cycle."
        >
          <SubscriptionGrid
            subscriptions={rows}
            total={subscriptions.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            filterOptions={filterOptions}
            onCreate={onCreate}
            {...(onOpen ? { onSubscriptionClick: (subscription) => onOpen(subscription.id) } : {})}
            {...(onOpenCustomer ? { onOpenCustomer } : {})}
            {...(onOpenPlan ? { onOpenPlan } : {})}
            onClearFilters={() =>
              onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })
            }
          />
        </ListState>
      </PageBody>
    </>
  )
}
