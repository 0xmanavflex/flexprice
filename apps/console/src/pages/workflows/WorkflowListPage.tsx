import { WorkflowIcon } from 'lucide-react'
import { type WorkflowQuery } from '@fp/domain'
import { ApiError, useWorkflowRuns } from '@fp/query'
import { WorkflowGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'

export interface WorkflowListPageProps {
  query: WorkflowQuery
  onQueryChange: (query: WorkflowQuery) => void
}

/** The wiring layer: fetch, turn an error into a sentence, hand the grid plain props. */
export function WorkflowListPage({ query, onQueryChange }: WorkflowListPageProps) {
  const workflows = useWorkflowRuns(query)

  const rows = workflows.data?.runs ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={workflows.isPending}
        error={toFailure(workflows.error)}
        isEmpty={rows.length === 0 && !isFiltered}
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

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to workflows here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading workflows.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading workflows.', canRetry: true }
}
