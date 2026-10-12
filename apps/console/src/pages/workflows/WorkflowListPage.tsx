import { WorkflowIcon } from '@fp/ui/icons'
import { type WorkflowQuery } from '@fp/domain'
import { useWorkflowRuns } from '@fp/query'
import { WorkflowGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface WorkflowListPageProps {
  query: WorkflowQuery
  onQueryChange: (query: WorkflowQuery) => void
}

/** The wiring layer: fetch, turn an error into a sentence, hand the grid plain props. */
export function WorkflowListPage({ query, onQueryChange }: WorkflowListPageProps) {
  const workflows = useWorkflowRuns(query)
  const failure = toListFailure(workflows.error, 'workflows')

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
        emptyIcon={<WorkflowIcon aria-hidden />}
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
        />
      </ListState>
    </PageBody>
  )
}
