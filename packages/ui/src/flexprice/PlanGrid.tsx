import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  PLAN_SORT_LABEL,
  type Plan,
  type PlanQuery,
  PlanSortField,
} from '@fp/domain'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@ui/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { Button } from '@ui/primitives/button'
import { Skeleton } from '@ui/primitives/skeleton'
import { EmptyState } from '@ui/compositions/EmptyState'
import { GridFooter } from '@ui/compositions/GridFooter'
import { GridToolbar } from '@ui/compositions/GridToolbar'
import { SortMenu } from '@ui/compositions/SortMenu'
import { useViewportPageSize } from '@ui/compositions/useViewportPageSize'
import { provenance } from '@ui/provenance'
import { CatalogStatusBadge } from './StatusBadge'

/**
 * The plan list.
 *
 * The same controlled shape as `FeatureGrid`: a dense table for scanning,
 * over one query. Filtering is passed in through the `filters` slot, so this
 * component never learns what a plan status is.
 */
export const PlanGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge'],
  note: 'Controlled wrapper; the page owns query state. A dense table over one query.',
})

const SORT_OPTIONS = Object.values(PlanSortField).map((value) => ({
  value,
  label: PLAN_SORT_LABEL[value],
}))

export interface PlanGridProps {
  plans: Plan[]
  total: number
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onPlanClick?: (plan: Plan) => void
  /** Filter controls, rendered beside Sort. */
  filters?: ReactNode
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

/** "2 charges", "1 charge", or the muted note that a plan bills nothing yet. */
function charges(count: number): ReactNode {
  if (count === 0) return <span className="text-muted-foreground">No charges</span>
  return `${count} charge${count === 1 ? '' : 's'}`
}

export function PlanGrid({
  plans,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPlanClick,
  filters,
  onClearFilters,
  locale,
}: PlanGridProps) {
  const columns = useMemo<ColumnDef<never, Plan>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: Plan) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Plan" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.name}</span>
              {row.original.lookupKey ? (
                <span className="truncate text-xs text-muted-foreground">
                  {row.original.lookupKey}
                </span>
              ) : null}
            </div>
          ),
          enableSorting: false,
          size: 260,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Plan) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: false,
          size: 120,
        },
        {
          id: 'charges',
          meta: { skeleton: <Skeleton className="h-4 w-20" /> },
          accessorFn: (row: Plan) => row.chargeCount,
          header: ({ column }: never) => <DataGridColumnHeader title="Charges" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => charges(row.original.chargeCount),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Plan) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => formatDate(row.original.createdAt, locale),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Plan) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => formatDate(row.original.updatedAt, locale),
          enableSorting: false,
          size: 140,
        },
      ] as never,
    [locale],
  )

  const pagination: PaginationState = {
    pageIndex: query.page - 1,
    pageSize: query.pageSize,
  }

  const table = useTable({
    features: dataGridFeatures,
    data: plans,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Plan) => row.id,
    state: { pagination },
    onPaginationChange: (updater: unknown) => {
      const next =
        typeof updater === 'function'
          ? (updater as (p: PaginationState) => PaginationState)(pagination)
          : (updater as PaginationState)
      onQueryChange({ ...query, page: next.pageIndex + 1, pageSize: next.pageSize })
    },
  } as never)

  const containerRef = useRef<HTMLDivElement>(null)
  // On by default: the pagination footer sits just below the last row rather
  // than the page size overflowing the viewport.
  const [fitToWindow, setFitToWindow] = useState(true)
  const capacity = useViewportPageSize({
    containerRef,
    enabled: fitToWindow,
    reservedHeight: 104,
  })

  if (fitToWindow && capacity !== null && capacity !== query.pageSize) {
    onQueryChange({ ...query, pageSize: capacity, page: 1 })
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="text-sm">{error}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col gap-3">
      <GridToolbar
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        placeholder="Search..."
        label="Search plans"
      >
        {filters}
        <SortMenu
          align="end"
          options={SORT_OPTIONS}
          field={query.sortBy}
          direction={query.sortDirection}
          onChange={(sortBy, sortDirection) =>
            onQueryChange({ ...query, sortBy, sortDirection, page: 1 })
          }
        />
      </GridToolbar>

      <DataGrid
        table={table as never}
        recordCount={total}
        isLoading={isLoading}
        emptyMessage={
          <EmptyState
            size="inline"
            isFiltered
            title="No plans match these filters"
            description="Try a different search, or clear what is narrowing the list."
            onClearFilters={
              onClearFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
        {...(onPlanClick ? { onRowClick: onPlanClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          // Auto, so columns fill the width rather than leaving an empty band on
          // the right; the name cell truncates so a long value stays contained.
          width: 'auto',
          rowBorder: false,
          dense: true,
        }}
      >
        {/* Wrapper makes ReUI's scroll-area root the flex-1 item (its className
            lands on an inner node), so it shrinks and scrolls rather than
            pushing the pagination off-screen on a tall list. */}
        <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
          <DataGridScrollArea className="min-h-0 flex-1">
            <DataGridTable />
          </DataGridScrollArea>
        </div>
        <GridFooter
          fitToWindow={fitToWindow}
          onFitToWindowChange={setFitToWindow}
          pageSize={query.pageSize}
          noun="plans"
        />
      </DataGrid>
    </div>
  )
}
