import { type DataExport, type DataExportQuery, EXPORT_STATE } from '@fp/domain'
import {
  useCreateDataExport,
  useDataExports,
  useDeleteDataExport,
  useS3Connections,
} from '@fp/query'
import { ConnectionExports, DataExportGrid } from '@fp/ui/pages'
import { ErrorState, ListState, PageLoadingState } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'
import { writeError } from './exportFailure'

export interface ConnectionExportsPageProps {
  connectionId: string
  query: DataExportQuery
  onQueryChange: (query: DataExportQuery) => void
  onBack: () => void
  onBackToExports: () => void
  onOpenExport: (row: DataExport) => void
}

/** One S3 connection's exports (V1's export management page). */
export function ConnectionExportsPage({
  connectionId,
  query,
  onQueryChange,
  onBack,
  onBackToExports,
  onOpenExport,
}: ConnectionExportsPageProps) {
  const connections = useS3Connections()
  const exports = useDataExports({ ...query, connectionId })
  const create = useCreateDataExport()
  const remove = useDeleteDataExport()

  if (connections.isPending) return <PageLoadingState variant="detail" label="Loading connection" />
  const connection = connections.data?.find((row) => row.id === connectionId)
  if (!connection) {
    const failure = toListFailure(connections.error, 'this connection')
    return (
      <ErrorState
        variant="page"
        title={failure ? 'This connection could not be loaded' : 'This connection no longer exists'}
        {...(failure ? { description: failure.message, kind: failure.kind } : {})}
        isRetrying={connections.isFetching}
        {...(failure?.canRetry ? { onRetry: () => void connections.refetch() } : {})}
      />
    )
  }

  const failure = toListFailure(exports.error, 'exports')
  const rows = exports.data?.exports ?? []
  const isFiltered = query.search.length > 0 || query.state !== EXPORT_STATE.All
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', state: EXPORT_STATE.All, page: 1 })

  return (
    <ConnectionExports
      connection={connection}
      onBack={onBack}
      onBackToExports={onBackToExports}
      onCreate={async (draft) => {
        try {
          await create.mutateAsync({ draft, flexpriceManaged: connection.flexpriceManaged })
        } catch (error) {
          throw writeError(error, 'The export could not be created.')
        }
      }}
      onDelete={async (row) => {
        try {
          await remove.mutateAsync(row.id)
        } catch (error) {
          throw writeError(error, 'The export could not be deleted.')
        }
      }}
      renderGrid={({ newExport, onDelete }) => (
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
          emptyTitle={`No exports on ${connection.name} yet`}
          emptyDescription="Create an export to start writing billing data to this bucket."
          createAction={newExport}
        >
          <DataExportGrid
            exports={rows}
            total={exports.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onClearFilters={clearFilters}
            onOpen={onOpenExport}
            onDelete={onDelete}
            primaryAction={newExport}
          />
        </ListState>
      )}
    />
  )
}
