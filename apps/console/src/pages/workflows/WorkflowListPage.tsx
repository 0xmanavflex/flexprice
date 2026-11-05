import { useState } from 'react'
import { type WorkflowQuery, type WorkflowRun } from '@fp/domain'
import { useWorkflowRunDetail, useWorkflowRuns } from '@fp/query'
import { WorkflowGrid, WorkflowRunSheet } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface WorkflowListPageProps {
  query: WorkflowQuery
  onQueryChange: (query: WorkflowQuery) => void
}

/**
 * The wiring layer: fetch, turn an error into a sentence, hand the grid plain
 * props. The query lives in the URL; the opened run is ephemeral, and its
 * details are read only while its sheet is open.
 */
export function WorkflowListPage({ query, onQueryChange }: WorkflowListPageProps) {
  const workflows = useWorkflowRuns(query)
  const failure = toListFailure(workflows.error, 'workflows')
  const [selected, setSelected] = useState<WorkflowRun | null>(null)
  const detail = useWorkflowRunDetail(
    selected ? { workflowId: selected.workflowId, runId: selected.id } : null,
  )
  const detailFailure = toListFailure(detail.error, 'this workflow run')

  const rows = workflows.data?.runs ?? []
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
          onRunClick={setSelected}
        />
      </ListState>
      <WorkflowRunSheet
        run={selected}
        detail={detail.data ?? null}
        isLoading={detail.isPending}
        error={detailFailure?.message ?? null}
        retrying={detail.isFetching && detail.isError}
        {...(detailFailure?.canRetry ? { onRetry: () => void detail.refetch() } : {})}
        onClose={() => setSelected(null)}
      />
    </PageBody>
  )
}
