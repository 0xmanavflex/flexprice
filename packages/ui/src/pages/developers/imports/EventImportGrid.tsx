import { type ReactNode, useMemo } from 'react'
import { BookOpenIcon, CopyIcon, EyeIcon, RefreshCwIcon } from '@ui/icons'
import {
  EVENT_IMPORT_STATUS,
  EVENT_IMPORT_STATUS_LABEL,
  type EventImport,
  type EventImportQuery,
} from '@fp/domain'
import { singleChoiceFilter } from '@ui/compositions/tables/FilterBar'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  type EntityColumn,
  dateColumn,
  idColumn,
  numberColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'
import { eventImportPill } from './eventImportStatus'

/**
 * Every CSV import of usage events, newest first, on the shared `EntityList`.
 *
 * Status is a server-side filter. A queued or running import keeps the list
 * polling (the page's hook does that); its counts fill in as it goes.
 */
export const EventImportGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Event import columns and status filter over the shared list table.',
})

const GUIDES: EntityGuide[] = [
  {
    title: 'Importing events',
    description: 'The CSV columns, and how a re-imported row is kept from counting twice.',
    href: 'https://docs.flexprice.io/docs/event-ingestion/overview',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
]

export interface EventImportGridProps {
  imports: EventImport[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: EventImportQuery
  onQueryChange: (query: EventImportQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onRefresh?: () => void
  onClearFilters?: () => void
  /** Opens an import's detail; rows become links. */
  onOpen?: (row: EventImport) => void
  /** The page's Import CSV button; Refresh sits beside it. */
  primaryAction?: ReactNode
  locale?: string
}

export function EventImportGrid({
  imports,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  onClearFilters,
  onOpen,
  primaryAction,
  locale,
}: EventImportGridProps) {
  const columns = useMemo<EntityColumn<EventImport>[]>(
    () => [
      textColumn<EventImport>('fileName', 'File', (row) => row.fileName || 'Untitled file', {
        width: 240,
        hideable: false,
      }),
      pillColumn<EventImport>('status', 'Status', eventImportPill),
      numberColumn<EventImport>('totalRecords', 'Rows', (row) => row.totalRecords, { locale }),
      numberColumn<EventImport>('successfulRecords', 'Imported', (row) => row.successfulRecords, {
        locale,
      }),
      numberColumn<EventImport>('failedRecords', 'Failed', (row) => row.failedRecords, {
        locale,
        zeroAsDash: true,
      }),
      dateColumn<EventImport>('createdAt', 'Uploaded', (row) => row.createdAt, { locale }),
      dateColumn<EventImport>('completedAt', 'Finished', (row) => row.completedAt ?? row.failedAt, {
        locale,
      }),
      idColumn<EventImport>('id', 'Import ID', (row) => row.id, { width: 200 }),
    ],
    [locale],
  )

  const term = query.search.trim().toLowerCase()
  const rows = term ? imports.filter((row) => row.fileName.toLowerCase().includes(term)) : imports

  const rowActions = (row: EventImport): EntityRowAction[] => [
    ...(onOpen
      ? [
          {
            label: 'View import',
            readOnly: true,
            icon: <EyeIcon aria-hidden className="size-4" />,
            onSelect: () => onOpen(row),
          },
        ]
      : []),
    {
      label: 'Copy import ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(row.id),
    },
  ]

  const refresh = onRefresh ? (
    <Button variant="outline" onClick={onRefresh}>
      <RefreshCwIcon aria-hidden />
      Refresh
    </Button>
  ) : null

  return (
    <EntityList<EventImport>
      label="Imports"
      noun="imports"
      rows={rows}
      total={total}
      columns={columns}
      getRowId={(row) => row.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      // The endpoint has no search, so the box narrows the page on screen.
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search })}
      searchPlaceholder="Search this page by file name…"
      isPageLocalFilter
      filter={singleChoiceFilter({
        id: 'status',
        label: 'Status',
        value: query.status,
        empty: EVENT_IMPORT_STATUS.All,
        choices: Object.values(EVENT_IMPORT_STATUS).map((value) => ({
          value,
          label: EVENT_IMPORT_STATUS_LABEL[value],
        })),
        onChange: (status) => onQueryChange({ ...query, status, page: 1 }),
      })}
      rowActions={rowActions}
      {...(onOpen ? { onRowClick: onOpen } : {})}
      primaryActionReadOnly={!primaryAction}
      {...(primaryAction || refresh
        ? {
            primaryAction: (
              <>
                {refresh}
                {primaryAction}
              </>
            ),
          }
        : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.status !== EVENT_IMPORT_STATUS.All || term.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No imports match these filters"
      empty={{
        scene: 'developers',
        title: 'No imports yet',
        description:
          'Import usage events from a CSV file: a backfill, or usage recorded outside your systems. Each import is listed here with how many rows went in.',
        guides: GUIDES,
      }}
    />
  )
}
