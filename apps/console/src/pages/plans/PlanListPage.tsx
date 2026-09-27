import { type Plan, type PlanQuery } from '@fp/domain'
import { ApiError, usePlans } from '@fp/query'
import { PlanFilters, PlanGrid } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { PackageIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface PlanListPageProps {
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  onCreate: () => void
  onOpenPlan: (plan: Plan) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `FeatureListPage`.
 *
 * Replaces V1's `Plans.tsx`, which owns drawer state and reaches into `PlanApi`
 * directly. This fetches, turns an error into a sentence, and hands the grid
 * plain props. No `useState`: the query lives in the URL.
 */
export function PlanListPage({ query, onQueryChange, onCreate, onOpenPlan }: PlanListPageProps) {
  const plans = usePlans(query)

  const failure = toFailure(plans.error)
  const rows = plans.data?.plans ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageHeader
        title="Plans"
        description="What you sell, and what each plan charges for."
        action={<Button onClick={onCreate}>New plan</Button>}
      />

      <PageBody>
        <ListState
          isLoading={plans.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void plans.refetch()}
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
          createAction={<Button onClick={onCreate}>New plan</Button>}
          emptyIcon={<PackageIcon aria-hidden />}
          emptyTitle="No plans yet"
          emptyDescription="Plans are what customers subscribe to. Each one carries charges, entitlements and credit grants — create the first to start selling."
        >
          <PlanGrid
            plans={rows}
            total={plans.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onPlanClick={onOpenPlan}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            filters={
              <PlanFilters
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
