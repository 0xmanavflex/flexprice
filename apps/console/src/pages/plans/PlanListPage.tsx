import { type PlanQuery } from '@fp/domain'
import { usePlans } from '@fp/query'
import { PlanGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface PlanListPageProps {
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  /** Open a plan's detail page. A row click, and where a new plan lands. */
  onOpenPlan: (planId: string) => void
  /** Start the full-page create flow. */
  onCreatePlan: () => void
}

/**
 * The plan surface: the list. Creating a plan is a full page (`/plans/new`).
 */
export function PlanListPage({
  query,
  onQueryChange,
  onOpenPlan,
  onCreatePlan,
}: PlanListPageProps) {
  const plans = usePlans(query)
  const failure = toListFailure(plans.error, 'plans')
  const rows = plans.data?.plans ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const clearFilters = () =>
    onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })

  return (
    <>
      <PageBody>
        <ListState
          isLoading={plans.isPending}
          error={failure}
          isEmpty={rows.length === 0 && (plans.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={plans.isFetching && !plans.isPending}
          isProvisional={plans.isPlaceholderData}
          isRetrying={plans.isFetching && plans.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          isFiltered={isFiltered}
          onRetry={() => void plans.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={() => onCreatePlan()}>New plan</Button>}
          emptyTitle="No plans yet"
          emptyDescription="Plans are what customers subscribe to. Each one carries charges, entitlements and credit grants — create the first to start selling."
        >
          <PlanGrid
            plans={rows}
            total={plans.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onPlanClick={(plan) => onOpenPlan(plan.id)}
            onCreate={() => onCreatePlan()}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>
    </>
  )
}
