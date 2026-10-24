import { useState } from 'react'
import {
  DEFAULT_CUSTOMER_QUERY,
  DEFAULT_PLAN_QUERY,
  type Subscription,
  type SubscriptionCancellationType,
  type SubscriptionQuery,
} from '@fp/domain'
import { useCancelSubscription, useCustomers, usePlans, useSubscriptions } from '@fp/query'
import { SubscriptionGrid, toast } from '@fp/ui/pages'
import { ConfirmDialog, ListState, OptionSelect, PageBody } from '@fp/ui/compositions'
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
  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, page: 1, pageSize: 100, filters: [] })
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, page: 1, pageSize: 100 })
  const filterOptions = {
    customer_id: (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name })),
    plan_id: (plans.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name })),
  }

  const cancel = useCancelSubscription()
  const [cancelling, setCancelling] = useState<Subscription | null>(null)
  const [when, setWhen] = useState<SubscriptionCancellationType>('end_of_period')
  const closeCancel = () => {
    setCancelling(null)
    cancel.reset()
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
            onCancelSubscription={(subscription) => {
              setWhen('end_of_period')
              setCancelling(subscription)
            }}
            onClearFilters={() =>
              onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })
            }
          />
        </ListState>
      </PageBody>
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => (open ? undefined : closeCancel())}
        title="Cancel this contract?"
        description={
          <span className="flex flex-col gap-3 pt-2 text-left">
            <span>
              {cancelling
                ? `${cancelling.customerName || 'This customer'} on ${cancelling.planName || 'this plan'}.`
                : null}{' '}
              Open the contract for proration, a date or a final invoice.
            </span>
            <label htmlFor="list-cancel-when" className="flex flex-col gap-1.5 text-sm">
              When
              <OptionSelect
                id="list-cancel-when"
                value={when}
                onValueChange={(value) => setWhen(value as SubscriptionCancellationType)}
                options={[
                  { value: 'end_of_period', label: 'At the end of the current period' },
                  { value: 'immediate', label: 'Immediately' },
                ]}
              />
            </label>
          </span>
        }
        confirmLabel="Cancel contract"
        cancelLabel="Keep contract"
        destructive
        isPending={cancel.isPending}
        error={cancel.isError ? 'The contract could not be cancelled. Try again.' : null}
        onConfirm={() => {
          if (!cancelling) return
          cancel.mutate(
            { id: cancelling.id, draft: { cancellationType: when, reason: '' } },
            {
              onSuccess: () => {
                closeCancel()
                toast('Contract cancelled')
              },
            },
          )
        }}
      />
    </>
  )
}
