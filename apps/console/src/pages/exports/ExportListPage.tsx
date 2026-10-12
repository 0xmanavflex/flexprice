import { DownloadCloudIcon } from '@fp/ui/icons'
import { type DataExportQuery, EXPORT_STATE } from '@fp/domain'
import { useDataExports } from '@fp/query'
import { DataExportGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface ExportListPageProps {
  query: DataExportQuery
  onQueryChange: (query: DataExportQuery) => void
}

/** The wiring layer: fetch, turn an error into a sentence, hand the grid plain props. */
export function ExportListPage({ query, onQueryChange }: ExportListPageProps) {
  const exports = useDataExports(query)
  const failure = toListFailure(exports.error, 'exports')

  const rows = exports.data?.exports ?? []
  const isFiltered = query.search.length > 0 || query.state !== EXPORT_STATE.All
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', state: EXPORT_STATE.All, page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={exports.isPending}
        error={failure}
        isEmpty={rows.length === 0 && (exports.data?.total ?? 0) === 0 && !isFiltered}
        hasRows={rows.length > 0}
        isRefreshing={exports.isFetching && !exports.isPending}
        isProvisional={exports.isPlaceholderData}
        isRetrying={exports.isFetching && exports.isError}
        {...(failure ? { failureKind: failure.kind } : {})}
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
