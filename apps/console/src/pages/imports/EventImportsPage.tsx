import { type EventImportQuery, EVENT_IMPORT_STATUS } from '@fp/domain'
import { useEventImport, useEventImports } from '@fp/query'
import { EventImportGrid, EventImportSheet, EventImportsOverview } from '@fp/ui/pages'
import { ListState } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'
import { CsvBoxImportButton } from './CsvBoxImportButton'

export interface EventImportsPageProps {
  query: EventImportQuery
  onQueryChange: (query: EventImportQuery) => void
}

/**
 * Imports: every CSV of usage events uploaded, with how far each got and why
 * rows failed, and the CSV format above a template. The open import is in the
 * URL (`open`), so it is a link; its sheet reads it on its own so a link to an
 * import on another page still opens.
 */
export function EventImportsPage({ query, onQueryChange }: EventImportsPageProps) {
  const imports = useEventImports(query)
  const opened = useEventImport(query.open)
  const failure = toListFailure(imports.error, 'imports')

  const rows = imports.data?.imports ?? []
  const isFiltered = query.status !== EVENT_IMPORT_STATUS.All || query.search.length > 0
  const clearFilters = () =>
    onQueryChange({ ...query, status: EVENT_IMPORT_STATUS.All, search: '', page: 1 })
  const open = (id: string) => onQueryChange({ ...query, open: id })
  const openRow = query.open
    ? (opened.data ?? rows.find((row) => row.id === query.open) ?? null)
    : null

  return (
    <EventImportsOverview>
      <ListState
        isLoading={imports.isPending}
        error={failure}
        isEmpty={rows.length === 0 && (imports.data?.total ?? 0) === 0 && !isFiltered}
        hasRows={rows.length > 0}
        isRefreshing={imports.isFetching && !imports.isPending}
        isProvisional={imports.isPlaceholderData}
        isRetrying={imports.isFetching && imports.isError}
        {...(failure ? { failureKind: failure.kind } : {})}
        isFiltered={isFiltered}
        onRetry={() => void imports.refetch()}
        onClearFilters={clearFilters}
        emptyTitle="No imports yet"
        emptyDescription="Import usage events from a CSV file. Download the template below to start."
      >
        <EventImportGrid
          imports={rows}
          total={imports.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onRefresh={() => void imports.refetch()}
          onClearFilters={clearFilters}
          onOpen={(row) => open(row.id)}
          primaryAction={<CsvBoxImportButton />}
        />
      </ListState>
      <EventImportSheet
        row={openRow}
        onClose={() => onQueryChange({ ...query, open: '' })}
        onRefresh={() => void opened.refetch()}
        isRefreshing={opened.isFetching}
      />
    </EventImportsOverview>
  )
}
