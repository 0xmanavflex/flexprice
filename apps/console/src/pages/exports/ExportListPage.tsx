import { DownloadCloudIcon } from '@fp/ui/icons'
import { type DataExportQuery, EXPORT_STATE } from '@fp/domain'
import { ApiError, useDataExports } from '@fp/query'
import { DataExportGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'

export interface ExportListPageProps {
  query: DataExportQuery
  onQueryChange: (query: DataExportQuery) => void
}

/** The wiring layer: fetch, turn an error into a sentence, hand the grid plain props. */
export function ExportListPage({ query, onQueryChange }: ExportListPageProps) {
  const exports = useDataExports(query)

  const rows = exports.data?.exports ?? []
  const isFiltered = query.search.length > 0 || query.state !== EXPORT_STATE.All
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', state: EXPORT_STATE.All, page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={exports.isPending}
        error={toFailure(exports.error)}
        isEmpty={rows.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={() => void exports.refetch()}
        onClearFilters={clearFilters}
        emptyIcon={<DownloadCloudIcon aria-hidden />}
        emptyTitle="No exports yet"
        emptyDescription="Exports send billing data to your own storage on a schedule."
      >
        <DataExportGrid
          exports={rows}
          total={exports.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onRefresh={() => void exports.refetch()}
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
        return { message: 'You do not have access to exports here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading exports.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading exports.', canRetry: true }
}
