import { useMemo } from 'react'
import { BookOpenIcon, CopyIcon, DownloadIcon, RefreshCwIcon } from '@ui/icons'
import {
  DEFAULT_WORKFLOW_QUERY,
  WORKFLOW_STATUS_LABEL,
  type WorkflowQuery,
  type WorkflowRun,
  WorkflowStatus,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { statusFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  type EntityColumn,
  type PillTone,
  idColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'

/**
 * The Workflows list, on the shared `EntityList`.
 *
 * A monitor, not a catalogue: nothing here is created or edited. The search
 * box matches the workflow id and the status dropdown takes one status, both
 * server-side on `POST /workflows/search`, so the list is the page the server
 * sent. Sorting is by start time only, which is the one order a monitor needs.
 */
export const WorkflowGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Workflow run columns and status filter over the shared list table.',
})

const STATUS_CHOICES = Object.values(WorkflowStatus).map((value) => ({
  value,
  label: WORKFLOW_STATUS_LABEL[value],
}))

const STATUS_TONE: Record<WorkflowStatus, PillTone> = {
  [WorkflowStatus.Running]: 'warning',
  [WorkflowStatus.Completed]: 'success',
  [WorkflowStatus.Failed]: 'danger',
  [WorkflowStatus.Canceled]: 'neutral',
  [WorkflowStatus.Terminated]: 'neutral',
  [WorkflowStatus.ContinuedAsNew]: 'warning',
  [WorkflowStatus.TimedOut]: 'neutral',
}

const GUIDES: EntityGuide[] = [
  {
    title: 'What runs as a workflow',
    description: 'Syncs, exports and billing runs are background workflows you can follow here.',
    href: 'https://docs.flexprice.io/docs/overview',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Exporting data',
    description: 'A data export shows up here as a run while it works.',
    href: 'https://docs.flexprice.io/docs/overview',
    icon: <DownloadIcon aria-hidden className="size-4" />,
  },
]

const SORT_OPTIONS = [{ value: 'start_time', label: 'Start time' }]

function formatDateTime(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(value)
}

/** Milliseconds as the unit a person reads: 850 ms, 12.5 s, 3.2 min, 1.4 hr. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${trim(seconds)} s`
  const minutes = seconds / 60
  if (minutes < 60) return `${trim(minutes)} min`
  return `${trim(minutes / 60)} hr`
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

export interface WorkflowGridProps {
  runs: WorkflowRun[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: WorkflowQuery
  onQueryChange: (query: WorkflowQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Re-runs the search; the page shows a refresh control because runs change under you. */
  onRefresh?: () => void
  onClearFilters?: () => void
  locale?: string
}

export function WorkflowGrid({
  runs,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  onClearFilters,
  locale,
}: WorkflowGridProps) {
  const columns = useMemo<EntityColumn<WorkflowRun>[]>(
    () => [
      textColumn<WorkflowRun>('name', 'Workflow', (row) => row.name, {
        width: 220,
        hideable: false,
      }),
      idColumn<WorkflowRun>('workflowId', 'Workflow ID', (row) => row.workflowId, { width: 220 }),
      idColumn<WorkflowRun>('id', 'Run ID', (row) => row.id, { width: 200 }),
      pillColumn<WorkflowRun>('status', 'Status', (row) =>
        row.status
          ? { label: WORKFLOW_STATUS_LABEL[row.status], tone: STATUS_TONE[row.status] }
          : null,
      ),
      textColumn<WorkflowRun>(
        'startTime',
        'Started',
        (row) => (row.startTime ? formatDateTime(row.startTime, locale) : null),
        { width: 200, muted: true, sortable: true, sortValue: 'start_time' },
      ),
      textColumn<WorkflowRun>(
        'closeTime',
        'Ended',
        (row) => (row.closeTime ? formatDateTime(row.closeTime, locale) : null),
        { width: 200, muted: true },
      ),
      textColumn<WorkflowRun>(
        'duration',
        'Duration',
        (row) => (row.durationMs === null ? null : formatDuration(row.durationMs)),
        { width: 110, muted: true },
      ),
    ],
    [locale],
  )

  const rowActions = (run: WorkflowRun): EntityRowAction[] => [
    {
      label: 'Copy workflow ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(run.workflowId),
    },
    {
      label: 'Copy run ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(run.id),
    },
  ]

  return (
    <EntityList<WorkflowRun>
      primaryActionReadOnly
      label="Workflows"
      noun="workflows"
      rows={runs}
      total={total}
      columns={columns}
      getRowId={(run) => run.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search by workflow ID…"
      filter={statusFilter({
        values: query.statuses,
        choices: STATUS_CHOICES,
        onChange: (statuses) => onQueryChange({ ...query, statuses, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: 'start_time',
        direction: query.sortDirection,
        activeCount: query.sortDirection === DEFAULT_WORKFLOW_QUERY.sortDirection ? 0 : 1,
        onChange: (_field, sortDirection) => onQueryChange({ ...query, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      exportFileName="workflows"
      {...(onRefresh
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
      isFiltered={query.search.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No workflows match these filters"
      empty={{
        scene: 'developers',
        title: 'No workflows have run yet',
        description:
          'Background work such as syncs, exports and billing runs is recorded here as it happens, so a stuck or failed job can be found.',
        guides: GUIDES,
      }}
    />
  )
}
