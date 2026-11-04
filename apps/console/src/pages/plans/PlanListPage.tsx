import { useMemo, useState } from 'react'
import { type Plan, type PlanQuery, RBAC_ENTITY, isPlanQueryFiltered } from '@fp/domain'
import { useArchivePlan, usePlanLinkage, usePlans } from '@fp/query'
import { DuplicatePlanDialog } from './DuplicatePlanDialog'
import { CreateWithAiButton, PlanGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody, useWriteAccess } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface PlanListPageProps {
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  /** Open a plan's detail page. A row click, and where a new plan lands. */
  onOpenPlan: (planId: string) => void
  /** Start the full-page create flow. */
  onCreatePlan: () => void
  /** Opens the describe-your-pricing flow. */
  onCreateWithAi: () => void
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
  onCreateWithAi,
  onEditPlan,
}: PlanListPageProps) {
  const plans = usePlans(query)
  const [duplicating, setDuplicating] = useState<Plan | null>(null)
  const archive = useArchivePlan()
  const [archiving, setArchiving] = useState<Plan | null>(null)
  const failure = toListFailure(plans.error, 'plans')
  const rows = useMemo(() => plans.data?.plans ?? [], [plans.data])
  // What each plan contains: entitlements, credit grants, contracts: read
  // for the rows on screen. None of it is on the plan itself.
  const linked = usePlanLinkage(useMemo(() => rows.map((plan) => plan.id), [rows]))
  const isFiltered = isPlanQueryFiltered(query)
  // Create with AI makes features as well as plans: V1 offers it only with
  // write on both. The route itself is gated on plan write.
  const featureWrite = useWriteAccess(RBAC_ENTITY.Feature)
  const createWithAi = featureWrite.allowed ? onCreateWithAi : undefined

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
          createAction={
            // The toolbar is not shown on an empty Plans page, so its AI entry
            // is offered here too, as V1 does on its empty state.
            <>
              {createWithAi ? <CreateWithAiButton onClick={createWithAi} /> : null}
              <Button onClick={() => onCreatePlan()}>New plan</Button>
            </>
          }
          emptyTitle="No plans yet"
          emptyDescription="Plans are what customers subscribe to. Each one carries charges, entitlements and credit grants: create the first to start selling."
        >
          <PlanGrid
            plans={rows}
            linkage={linked.byPlan}
            linkageLoading={linked.isPending}
            total={plans.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            {...(createWithAi ? { onCreateWithAi: createWithAi } : {})}
            onPlanClick={(plan) => onOpenPlan(plan.id)}
            onEdit={(plan) => onEditPlan(plan.id)}
            onAddCharges={(plan) => onOpenPlan(plan.id)}
            onDuplicate={(plan) => setDuplicating(plan)}
            onArchive={(plan) => setArchiving(plan)}
            onCreate={() => onCreatePlan()}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <DuplicatePlanDialog
        plan={duplicating}
        onClose={() => setDuplicating(null)}
        onDuplicated={onOpenPlan}
      />

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
