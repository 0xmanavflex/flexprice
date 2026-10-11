import { type PlanQuery } from '@fp/domain'
import { ApiError, usePlans } from '@fp/query'
import { PlanGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { PackageIcon } from '@fp/ui/icons'
import { Button } from '@fp/ui/primitives'

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
  const failure = toFailure(plans.error)
  const rows = plans.data?.plans ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <PageBody>
        <ListState
          isLoading={plans.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void plans.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={() => onCreatePlan()}>New plan</Button>}
          emptyIcon={<PackageIcon aria-hidden />}
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

/** A failure, as a sentence and a judgement about whether retrying can help. */
function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to plans here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading plans.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading plans.', canRetry: true }
}
