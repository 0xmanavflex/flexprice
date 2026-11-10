import { useState } from 'react'
import { DEFAULT_WORKFLOW_QUERY, type WorkflowQuery, type WorkflowRun } from '@fp/domain'
import { PLAN_PRICE_SYNC_WORKFLOW, useWorkflowRunDetail, useWorkflowRuns } from '@fp/query'
import { WorkflowGrid, WorkflowRunSheet } from '@fp/ui/pages'
import { toListFailure } from '../shared/listFailure'

/**
 * A plan's price syncs: each "Sync to contracts" run, newest first, with the
 * run's details a click away. The same grid and sheet as Workflows, narrowed
 * to this plan's `PriceSyncV2Workflow` runs, so whoever changed a price can see
 * whether it reached the contracts without leaving the plan.
 */
export function PlanPriceSyncTab({ planId }: { planId: string }) {
  const [query, setQuery] = useState<WorkflowQuery>(DEFAULT_WORKFLOW_QUERY)
  const [openRun, setOpenRun] = useState<{ workflowId: string; runId: string } | null>(null)
  const runs = useWorkflowRuns(query, {
    entity: 'plan',
    entityId: planId,
    workflowType: PLAN_PRICE_SYNC_WORKFLOW,
  })
  const failure = toListFailure(runs.error, 'price syncs')
  const detail = useWorkflowRunDetail(openRun)
  const detailFailure = toListFailure(detail.error, 'this price sync')

  const rows = runs.data?.runs ?? []
  const selected: WorkflowRun | null = openRun
    ? (rows.find((row) => row.workflowId === openRun.workflowId && row.id === openRun.runId) ??
      null)
    : null
  const clearFilters = () => setQuery({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <WorkflowGrid
        label="Price syncs"
        runs={rows}
        total={runs.data?.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        isLoading={runs.isPending}
        error={failure?.message ?? null}
        {...(failure?.canRetry ? { onRetry: () => void runs.refetch() } : {})}
        onRefresh={() => void runs.refetch()}
        onClearFilters={clearFilters}
        onRunClick={(run) => setOpenRun({ workflowId: run.workflowId, runId: run.id })}
        empty={{
          title: 'No price syncs yet',
          description:
            "Sync to contracts, in the plan's menu, pushes this plan's current prices to its contracts. Each run is listed here.",
        }}
      />
      <WorkflowRunSheet
        run={selected}
        open={openRun !== null}
        detail={detail.data ?? null}
        isLoading={detail.isPending}
        error={detailFailure?.message ?? null}
        retrying={detail.isFetching && detail.isError}
        {...(detailFailure?.canRetry ? { onRetry: () => void detail.refetch() } : {})}
        onClose={() => setOpenRun(null)}
      />
    </>
  )
}
