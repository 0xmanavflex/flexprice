import { type DataExport, type DataExportQuery, EXPORT_STATE } from '@fp/domain'
import { useDataExports, useS3Connections } from '@fp/query'
import { DataExportGrid, ExportsOverview } from '@fp/ui/pages'
import { ListState } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface ExportListPageProps {
  query: DataExportQuery
  onQueryChange: (query: DataExportQuery) => void
  onOpenS3: () => void
  onOpenExport: (row: DataExport) => void
}

/**
 * The Exports landing page, as V1's: what exports do and where they go
 * (Amazon S3), then every export. Fetches, turns an error into a sentence,
 * and hands the compositions plain props.
 */
export function ExportListPage({
  query,
  onQueryChange,
  onOpenS3,
  onOpenExport,
}: ExportListPageProps) {
  const exports = useDataExports(query)
  const connections = useS3Connections()
  const failure = toListFailure(exports.error, 'exports')

  const rows = exports.data?.exports ?? []
  const isFiltered = query.search.length > 0 || query.state !== EXPORT_STATE.All
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', state: EXPORT_STATE.All, page: 1 })

  return (
    <ExportsOverview s3Connections={connections.data?.length ?? null} onOpenS3={onOpenS3}>
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
        emptyTitle="No exports yet"
        emptyDescription="Connect an S3 bucket under Destinations, then create an export on it."
      >
        <DataExportGrid
          exports={rows}
          total={exports.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onRefresh={() => void exports.refetch()}
          onClearFilters={clearFilters}
          onOpen={onOpenExport}
        />
      </ListState>
    </ExportsOverview>
  )
}
