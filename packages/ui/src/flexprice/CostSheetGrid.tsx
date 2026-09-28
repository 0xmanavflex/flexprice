import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  COST_SHEET_SORT_LABEL,
  type CostSheet,
  type CostSheetQuery,
  CostSheetSortField,
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
 * The cost sheet list.
 *
 * The same controlled table shape as `CouponGrid`, with a cost sheet's
 * own columns: what it covers, how many prices it groups, and its status.
 * Filtering is passed in through the `filters` slot.
 */
export const CostSheetGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid'],
  note: 'Controlled wrapper; the page owns query state. A dense table over one query.',
})

const SORT_OPTIONS = Object.values(CostSheetSortField).map((value) => ({
  value,
  label: COST_SHEET_SORT_LABEL[value],
}))

export interface CostSheetGridProps {
  costSheets: CostSheet[]
  total: number
  query: CostSheetQuery
  onQueryChange: (query: CostSheetQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onCostSheetClick?: (costSheet: CostSheet) => void
  filters?: ReactNode
  onClearFilters?: () => void
  locale?: string
}

/** A date, de-emphasised: secondary metadata reads as muted, tabular figures. */
function DateCell({ value, locale }: { value: Date | null; locale?: string }): ReactNode {
  const text = value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : '—'
  return <span className="tabular-nums text-muted-foreground">{text}</span>
}

/** "12 prices", "1 price", or "—" when the sheet groups none. */
function pricesLabel(costSheet: CostSheet, locale?: string): string {
  if (costSheet.priceCount === 0) return '—'
  const count = new Intl.NumberFormat(locale).format(costSheet.priceCount)
  return `${count} ${costSheet.priceCount === 1 ? 'price' : 'prices'}`
}

export function CostSheetGrid({
  costSheets,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onCostSheetClick,
  filters,
  onClearFilters,
  locale,
}: CostSheetGridProps) {
  const columns = useMemo<ColumnDef<never, CostSheet>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: CostSheet) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Cost sheet" column={column} />,
          cell: ({ row }: { row: { original: CostSheet } }) => (
            <div className="flex min-w-0 flex-col">
              <span className="truncate">{row.original.name}</span>
              {row.original.lookupKey ? (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {row.original.lookupKey}
                </span>
              ) : null}
            </div>
          ),
          enableSorting: true,
          size: 260,
        },
        {
          id: 'description',
          meta: { skeleton: <Skeleton className="h-4 w-48" /> },
          accessorFn: (row: CostSheet) => row.description,
          header: ({ column }: never) => (
            <DataGridColumnHeader title="Description" column={column} />
          ),
          cell: ({ row }: { row: { original: CostSheet } }) =>
            row.original.description ? (
              <span className="truncate text-muted-foreground">{row.original.description}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          enableSorting: true,
          size: 280,
        },
        {
          id: 'prices',
          meta: { skeleton: <Skeleton className="h-4 w-16" /> },
          accessorFn: (row: CostSheet) => row.priceCount,
          header: ({ column }: never) => <DataGridColumnHeader title="Prices" column={column} />,
          cell: ({ row }: { row: { original: CostSheet } }) => (
            <span className="tabular-nums text-muted-foreground">
              {pricesLabel(row.original, locale)}
            </span>
          ),
          enableSorting: true,
          size: 120,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: CostSheet) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: CostSheet } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: true,
          size: 120,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: CostSheet) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: CostSheet } }) => (
            <DateCell value={row.original.updatedAt} {...(locale ? { locale } : {})} />
          ),
          enableSorting: true,
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
    data: costSheets,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: CostSheet) => row.id,
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
  const [fitToWindow, setFitToWindow] = useState(false)
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
        heading="Cost sheets"
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        placeholder="Search cost sheets…"
        label="Search cost sheets"
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
            title="No cost sheets match these filters"
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
        {...(onCostSheetClick ? { onRowClick: onCostSheetClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          width: 'auto',
          rowBorder: false,
          dense: true,
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
          <DataGridScrollArea className="min-h-0 flex-1">
            <DataGridTable />
          </DataGridScrollArea>
        </div>
        <GridFooter
          fitToWindow={fitToWindow}
          onFitToWindowChange={setFitToWindow}
          pageSize={query.pageSize}
          noun="cost sheets"
        />
      </DataGrid>
    </div>
  )
}
