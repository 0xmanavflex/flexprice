import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  TAX_RATE_SCOPE_LABEL,
  TAX_RATE_SORT_LABEL,
  type TaxRate,
  type TaxRateQuery,
  TaxRateSortField,
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
 * The tax-rate list, as a *controlled* grid.
 *
 * The same table-only shape as `InvoiceGrid` — no cards, no view toggle, one
 * page of rows the server already paged. It holds no state and performs no
 * fetching: the page owns the `query` and keeps it in the URL, and the grid
 * only renders and reports intent. Filtering rides in through the `filters`
 * slot, the same way the coupon grid takes it.
 *
 * It also cannot import `@fp/query`; ESLint forbids it. That constraint is what
 * keeps the query in the URL rather than hidden in a private fetch here.
 */
export const TaxRateGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge'],
  note: 'Controlled wrapper: the page owns query state, the grid only renders and reports intent.',
})

const SORT_OPTIONS = Object.values(TaxRateSortField).map((value) => ({
  value,
  label: TAX_RATE_SORT_LABEL[value],
}))

export interface TaxRateGridProps {
  taxRates: TaxRate[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: TaxRateQuery
  onQueryChange: (query: TaxRateQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onTaxRateClick?: (taxRate: TaxRate) => void
  /** Passed in from the page, aligned to the end of the toolbar. */
  filters?: ReactNode
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for dates. Supplied by the app, never read from a global. */
  locale?: string
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

export function TaxRateGrid({
  taxRates,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onTaxRateClick,
  filters,
  onClearFilters,
  locale,
}: TaxRateGridProps) {
  const columns = useMemo<ColumnDef<never, TaxRate>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: TaxRate) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Name" column={column} />,
          cell: ({ row }: { row: { original: TaxRate } }) => (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.name}</span>
              {row.original.code ? (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {row.original.code}
                </span>
              ) : null}
            </div>
          ),
          enableSorting: false,
          size: 260,
        },
        {
          id: 'rate',
          meta: { skeleton: <Skeleton className="h-4 w-12" /> },
          accessorFn: (row: TaxRate) => row.percentageValue,
          header: ({ column }: never) => <DataGridColumnHeader title="Rate" column={column} />,
          // The percentage as the API sends it, never re-scaled to a fraction.
          // Tabular figures so a column of rates lines up rather than wobbling.
          cell: ({ row }: { row: { original: TaxRate } }) => (
            <span className="tabular-nums">
              {row.original.percentageValue ? `${row.original.percentageValue}%` : '—'}
            </span>
          ),
          enableSorting: false,
          size: 120,
        },
        {
          id: 'scope',
          meta: { skeleton: <Skeleton className="h-4 w-20" /> },
          accessorFn: (row: TaxRate) => row.scope,
          header: ({ column }: never) => <DataGridColumnHeader title="Scope" column={column} />,
          cell: ({ row }: { row: { original: TaxRate } }) => (
            <span className="text-muted-foreground">
              {TAX_RATE_SCOPE_LABEL[row.original.scope]}
            </span>
          ),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: TaxRate) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: TaxRate } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: false,
          size: 120,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: TaxRate) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: TaxRate } }) =>
            formatDate(row.original.createdAt, locale),
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
    data: taxRates,
    columns,
    // Server-side: `data` is exactly one page, so the grid must not re-page it.
    // `rowCount` is what makes getPageCount() correct.
    manualPagination: true,
    rowCount: total,
    getRowId: (row: TaxRate) => row.id,
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
    // The toolbar above and the pagination footer below are not rows.
    reservedHeight: 104,
  })

  // `null` means "no measurement yet" — keep whatever size is already set.
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
        label="Search tax rates"
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
            title="No tax rates match these filters"
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
        {...(onTaxRateClick ? { onRowClick: onTaxRateClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          // Auto, so the columns spread to fill the width instead of leaving a
          // band of empty table on the right. The `size` hints still set the
          // proportions; the name cell truncates so a long value cannot blow the
          // column out.
          width: 'auto',
          rowBorder: false,
          dense: true,
        }}
      >
        {/* ReUI's DataGridScrollArea puts `className` on an inner node, so this
            wrapper makes the root (`> div`) the flex child that fills and
            scrolls, keeping the pagination footer pinned in view once the list
            is taller than the viewport. */}
        <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
          <DataGridScrollArea className="min-h-0 flex-1">
            <DataGridTable />
          </DataGridScrollArea>
        </div>
        <GridFooter
          fitToWindow={fitToWindow}
          onFitToWindowChange={setFitToWindow}
          pageSize={query.pageSize}
          noun="tax rates"
        />
      </DataGrid>
    </div>
  )
}
