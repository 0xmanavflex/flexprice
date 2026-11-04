import { type ReactNode, useMemo } from 'react'
import { BookOpenIcon, CopyIcon, EyeIcon, RefreshCwIcon, Trash2Icon } from '@ui/icons'
import {
  DOCS,
  type DataExport,
  type DataExportQuery,
  EXPORT_STATE,
  type ExportState,
} from '@fp/domain'
import { singleChoiceFilter } from '@ui/compositions/tables/FilterBar'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import { type EntityColumn, idColumn, pillColumn, textColumn } from '../../shared/cells'

/**
 * The Exports list, on the shared `EntityList`.
 *
 * A read-only view of the scheduled exports: what is sent, how often, and to
 * which bucket. The status dropdown (active / paused) is a server-side
 * filter; the search box narrows the page by bucket, prefix or entity.
 */
export const DataExportGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Scheduled export columns and enabled filter over the shared list table.',
})

const STATE_LABEL: Record<ExportState, string> = {
  [EXPORT_STATE.All]: 'All',
  // The rows' words, so the filter and the list name a state the same way.
  [EXPORT_STATE.Enabled]: 'Active',
  [EXPORT_STATE.Disabled]: 'Paused',
}

const GUIDES: EntityGuide[] = [
  {
    title: 'Exporting to S3',
    description: 'How exports write billing data to a bucket you own.',
    href: DOCS.s3Export,
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
]

function formatDate(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

export interface DataExportGridProps {
  exports: DataExport[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: DataExportQuery
  onQueryChange: (query: DataExportQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onRefresh?: () => void
  onClearFilters?: () => void
  /** Opens an export's detail; rows become links. */
  onOpen?: (row: DataExport) => void
  /** Offers Delete in each row's menu. */
  onDelete?: (row: DataExport) => void
  /** Replaces Refresh as the header action, e.g. "Add task". */
  primaryAction?: ReactNode
  locale?: string
}

export function DataExportGrid({
  exports,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  onClearFilters,
  onOpen,
  onDelete,
  primaryAction,
  locale,
}: DataExportGridProps) {
  const columns = useMemo<EntityColumn<DataExport>[]>(
    () => [
      textColumn<DataExport>('entity', 'Data', (row) => row.entityLabel, {
        width: 200,
        hideable: false,
      }),
      textColumn<DataExport>('interval', 'Runs', (row) => row.intervalLabel, { width: 110 }),
      pillColumn<DataExport>('state', 'Status', (row) => ({
        // The detail page's words, so one export reads the same everywhere.
        label: row.enabled ? 'Active' : 'Paused',
        tone: row.enabled ? 'success' : 'neutral',
      })),
      textColumn<DataExport>('bucket', 'Bucket', (row) => row.bucket, { width: 220 }),
      textColumn<DataExport>('region', 'Region', (row) => row.region, { width: 130, muted: true }),
      textColumn<DataExport>('keyPrefix', 'Key prefix', (row) => row.keyPrefix, {
        width: 180,
        muted: true,
      }),
      idColumn<DataExport>('id', 'Export ID', (row) => row.id, { width: 200 }),
      textColumn<DataExport>(
        'createdAt',
        'Created',
        (row) => (row.createdAt ? formatDate(row.createdAt, locale) : null),
        { width: 130, muted: true },
      ),
    ],
    [locale],
  )

  const rowActions = (row: DataExport): EntityRowAction[] => [
    ...(onOpen
      ? [
          {
            label: 'View export',
            readOnly: true,
            icon: <EyeIcon aria-hidden className="size-4" />,
            onSelect: () => onOpen(row),
          },
        ]
      : []),
    {
      label: 'Copy export ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(row.id),
    },
    ...(onDelete
      ? [
          {
            label: 'Delete export',
            icon: <Trash2Icon aria-hidden className="size-4" />,
            destructive: true,
            onSelect: () => onDelete(row),
          },
        ]
      : []),
  ]

  return (
    <EntityList<DataExport>
      label="Exports"
      noun="exports"
      rows={exports}
      total={total}
      columns={columns}
      getRowId={(row) => row.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search by bucket or data…"
      filter={singleChoiceFilter({
        id: 'state',
        label: 'Status',
        value: query.state,
        empty: EXPORT_STATE.All,
        choices: Object.values(EXPORT_STATE).map((value) => ({
          value,
          label: STATE_LABEL[value],
        })),
        onChange: (state) => onQueryChange({ ...query, state, page: 1 }),
      })}
      rowActions={rowActions}
      exportFileName="exports"
      {...(onOpen ? { onRowClick: onOpen } : {})}
      // Refresh does not write; an "Add task" given by the page does.
      primaryActionReadOnly={!primaryAction}
      {...(primaryAction
        ? { primaryAction }
        : onRefresh
          ? {
              primaryAction: (
                <Button variant="outline" onClick={onRefresh}>
                  <RefreshCwIcon aria-hidden />
                  Refresh
                </Button>
              ),
            }
          : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.state !== EXPORT_STATE.All}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No exports match these filters"
      empty={{
        scene: 'developers',
        title: 'No exports yet',
        description:
          'Exports send billing data to your own storage on a schedule, so it can be joined with the rest of your data.',
        guides: GUIDES,
      }}
    />
  )
}
