import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  PRICE_UNIT_SORT_LABEL,
  type PriceUnit,
  type PriceUnitQuery,
  PriceUnitSortField,
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
 * The price-unit list.
 *
 * The same controlled table shape as `CouponGrid`, with a price unit's own
 * columns: its code and symbol, the currency it converts into, and the rate it
 * converts at. Filtering is passed in through the `filters` slot; the page owns
 * the query.
 */
export const PriceUnitGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid'],
  note: 'Controlled wrapper; the page owns query state. A dense table over one query.',
})

const SORT_OPTIONS = Object.values(PriceUnitSortField).map((value) => ({
  value,
  label: PRICE_UNIT_SORT_LABEL[value],
}))

export interface PriceUnitGridProps {
  priceUnits: PriceUnit[]
  total: number
  query: PriceUnitQuery
  onQueryChange: (query: PriceUnitQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onPriceUnitClick?: (priceUnit: PriceUnit) => void
  filters?: ReactNode
  onClearFilters?: () => void
  locale?: string
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

/**
 * The rate, to as many decimals as it carries.
 *
 * A rate can be `0.0000025` (tokens) or `1.5` (coins), so the formatter keeps up
 * to eight fraction digits — V1's own ceiling — rather than the locale default
 * of three, which would round a small rate to `0`. A value that will not parse
 * shows an em dash instead of `NaN`.
 */
function formatConversionRate(rate: string, locale?: string): string {
  const parsed = Number.parseFloat(rate)
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(parsed)
}

export function PriceUnitGrid({
  priceUnits,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPriceUnitClick,
  filters,
  onClearFilters,
  locale,
}: PriceUnitGridProps) {
  const columns = useMemo<ColumnDef<never, PriceUnit>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: PriceUnit) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Name" column={column} />,
          cell: ({ row }: { row: { original: PriceUnit } }) => (
            <span className="truncate font-medium">{row.original.name}</span>
          ),
          enableSorting: false,
          size: 240,
        },
        {
          id: 'code',
          meta: { skeleton: <Skeleton className="h-4 w-12" /> },
          accessorFn: (row: PriceUnit) => row.code,
          header: ({ column }: never) => <DataGridColumnHeader title="Code" column={column} />,
          cell: ({ row }: { row: { original: PriceUnit } }) => (
            <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
          ),
          enableSorting: false,
          size: 100,
        },
        {
          id: 'symbol',
          meta: { skeleton: <Skeleton className="h-4 w-8" /> },
          accessorFn: (row: PriceUnit) => row.symbol,
          header: ({ column }: never) => <DataGridColumnHeader title="Symbol" column={column} />,
          cell: ({ row }: { row: { original: PriceUnit } }) => (
            <span className="text-base leading-none">{row.original.symbol || '—'}</span>
          ),
          enableSorting: false,
          size: 90,
        },
        {
          id: 'baseCurrency',
          meta: { skeleton: <Skeleton className="h-4 w-14" /> },
          accessorFn: (row: PriceUnit) => row.baseCurrency,
          header: ({ column }: never) => (
            <DataGridColumnHeader title="Base currency" column={column} />
          ),
          cell: ({ row }: { row: { original: PriceUnit } }) => (
            <span className="tabular-nums">{row.original.baseCurrency.toUpperCase() || '—'}</span>
          ),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'conversionRate',
          meta: { skeleton: <Skeleton className="h-4 w-16" /> },
          accessorFn: (row: PriceUnit) => row.conversionRate,
          header: ({ column }: never) => (
            <DataGridColumnHeader title="Conversion rate" column={column} />
          ),
          cell: ({ row }: { row: { original: PriceUnit } }) => (
            <span className="tabular-nums text-muted-foreground">
              {formatConversionRate(row.original.conversionRate, locale)}
            </span>
          ),
          enableSorting: false,
          size: 160,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: PriceUnit) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: PriceUnit } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: false,
          size: 120,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: PriceUnit) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: PriceUnit } }) =>
            formatDate(row.original.updatedAt, locale),
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
    data: priceUnits,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: PriceUnit) => row.id,
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
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        placeholder="Search..."
        label="Search price units"
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
            title="No price units match these filters"
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
        {...(onPriceUnitClick ? { onRowClick: onPriceUnitClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          // Auto, so the columns spread to fill the width instead of leaving a
          // band of empty table on the right — the same choice the coupon and
          // add-on grids make.
          width: 'auto',
          rowBorder: false,
          dense: true,
        }}
      >
        {/* The table scrolls within a bounded region so the pagination footer
            below stays pinned in view, the same pattern the other catalogue
            grids use. */}
        <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
          <DataGridScrollArea className="min-h-0 flex-1">
            <DataGridTable />
          </DataGridScrollArea>
        </div>
        <GridFooter
          fitToWindow={fitToWindow}
          onFitToWindowChange={setFitToWindow}
          pageSize={query.pageSize}
          noun="price units"
        />
      </DataGrid>
    </div>
  )
}
