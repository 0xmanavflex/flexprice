import { type WorkflowQuery, type WorkflowRun } from '@fp/domain'
import { useWorkflowRunDetail, useWorkflowRuns } from '@fp/query'
import { WorkflowGrid, WorkflowRunSheet } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface WorkflowListPageProps {
  query: WorkflowQuery
  onQueryChange: (query: WorkflowQuery) => void
  /** The run open over the list, from the address; `null` when none is. */
  openRun: { workflowId: string; runId: string } | null
  /** Opens a run (a new history entry) or closes it. */
  onOpenRunChange: (run: { workflowId: string; runId: string } | null) => void
}

/**
 * The wiring layer: fetch, turn an error into a sentence, hand the grid plain
 * props. The query and the opened run both live in the URL, so a reload, a
 * shared link or Back keeps the run open; its details are read only while its
 * sheet is open.
 */
export function WorkflowListPage({
  query,
  onQueryChange,
  openRun,
  onOpenRunChange,
}: WorkflowListPageProps) {
  const workflows = useWorkflowRuns(query)
  const failure = toListFailure(workflows.error, 'workflows')
  const detail = useWorkflowRunDetail(openRun)
  const detailFailure = toListFailure(detail.error, 'this workflow run')

  const rows = workflows.data?.runs ?? []
  // The opened run's row, when it is on this page: its summary shows while the detail loads.
  const selected: WorkflowRun | null = openRun
    ? (rows.find((row) => row.workflowId === openRun.workflowId && row.id === openRun.runId) ??
      null)
    : null
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={workflows.isPending}
        error={failure}
        isEmpty={rows.length === 0 && (workflows.data?.total ?? 0) === 0 && !isFiltered}
        hasRows={rows.length > 0}
        isRefreshing={workflows.isFetching && !workflows.isPending}
        isProvisional={workflows.isPlaceholderData}
        isRetrying={workflows.isFetching && workflows.isError}
        {...(failure ? { failureKind: failure.kind } : {})}
        isFiltered={isFiltered}
        onRetry={() => void workflows.refetch()}
        onClearFilters={clearFilters}
        emptyTitle="No workflows yet"
        emptyDescription="Background work such as syncs, exports and billing runs is recorded here as it happens."
      >
        <WorkflowGrid
          runs={rows}
          total={workflows.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onRefresh={() => void workflows.refetch()}
          onClearFilters={clearFilters}
          onRunClick={(run) => onOpenRunChange({ workflowId: run.workflowId, runId: run.id })}
        />
      </ListState>
      <WorkflowRunSheet
        run={selected}
        open={openRun !== null}
        detail={detail.data ?? null}
        isLoading={detail.isPending}
        error={detailFailure?.message ?? null}
        retrying={detail.isFetching && detail.isError}
        {...(detailFailure?.canRetry ? { onRetry: () => void detail.refetch() } : {})}
        onClose={() => onOpenRunChange(null)}
      />
    </PageBody>
  )
}
