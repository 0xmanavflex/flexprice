import { useState } from 'react'
import { type Plan, type PlanQuery } from '@fp/domain'
import { useArchivePlan, useClonePlan, usePlans } from '@fp/query'
import { PlanGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface PlanListPageProps {
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  /** Open a plan's detail page. A row click, and where a new plan lands. */
  onOpenPlan: (planId: string) => void
  /** Start the full-page create flow. */
  onCreatePlan: () => void
  /** Open the full-page edit form. */
  onEditPlan: (planId: string) => void
}

/**
 * The plan surface: the list. Creating a plan is a full page (`/plans/new`).
 */
export function PlanListPage({
  query,
  onQueryChange,
  onOpenPlan,
  onCreatePlan,
  onEditPlan,
}: PlanListPageProps) {
  const plans = usePlans(query)
  const clone = useClonePlan()
  const archive = useArchivePlan()
  const [archiving, setArchiving] = useState<Plan | null>(null)
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
            onEdit={(plan) => onEditPlan(plan.id)}
            onAddCharges={(plan) => onOpenPlan(plan.id)}
            onDuplicate={(plan) =>
              clone.mutate(
                { id: plan.id, name: `${plan.name} (copy)` },
                {
                  onSuccess: (result) => {
                    const id = (result as { id?: string } | undefined)?.id
                    if (id) onOpenPlan(id)
                  },
                },
              )
            }
            onArchive={(plan) => setArchiving(plan)}
            onCreate={() => onCreatePlan()}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(null)
            archive.reset()
          }
        }}
        title={`Archive ${archiving?.name ?? 'this plan'}?`}
        description="Archiving retires the plan from the catalogue. Existing contracts keep billing; the plan can no longer be added to new ones."
        confirmLabel="Archive plan"
        destructive
        isPending={archive.isPending}
        error={archive.isError ? 'Could not archive the plan. Try again.' : null}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) })
        }}
      />
    </>
  )
}
