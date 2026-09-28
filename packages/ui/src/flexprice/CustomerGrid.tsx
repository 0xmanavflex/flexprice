import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  CUSTOMER_SORT_LABEL,
  type Customer,
  type CustomerQuery,
  CustomerSortField,
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
 * The customer list, as a *controlled*, table-only grid.
 *
 * The same shape as `InvoiceGrid`: the page owns the query and keeps it in the
 * URL, the grid holds no state and fetches nothing. A billing list is a ledger,
 * not a catalogue — so there is no card view and no layout toggle, only a table
 * over one query. Filtering is passed in through the `filters` slot.
 */
export const CustomerGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge'],
  note: 'Controlled, table-only wrapper: the page owns query state, the grid renders and reports intent.',
})

const SORT_OPTIONS = Object.values(CustomerSortField).map((value) => ({
  value,
  label: CUSTOMER_SORT_LABEL[value],
}))

export interface CustomerGridProps {
  customers: Customer[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: CustomerQuery
  onQueryChange: (query: CustomerQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onCustomerClick?: (customer: Customer) => void
  filters?: ReactNode
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for dates. Supplied by the app, never read from a global. */
  locale?: string
}

/** A date, de-emphasised: secondary metadata reads as muted, tabular figures. */
function DateCell({ value, locale }: { value: Date | null; locale?: string }): ReactNode {
  const text = value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : '—'
  return <span className="tabular-nums text-muted-foreground">{text}</span>
}

export function CustomerGrid({
  customers,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onCustomerClick,
  filters,
  onClearFilters,
  locale,
}: CustomerGridProps) {
  const columns = useMemo<ColumnDef<never, Customer>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: Customer) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Customer" column={column} />,
          // The name leads, the email sits under it as a muted subtitle — the
          // two facts a billing operator scans a customer by, in one cell.
          cell: ({ row }: { row: { original: Customer } }) => (
            <div className="flex min-w-0 flex-col">
              <span className="truncate">{row.original.name}</span>
              {row.original.email ? (
                <span className="truncate text-xs text-muted-foreground">{row.original.email}</span>
              ) : null}
            </div>
          ),
          enableSorting: true,
          size: 280,
        },
        {
          id: 'externalId',
          meta: { skeleton: <Skeleton className="h-4 w-28" /> },
          accessorFn: (row: Customer) => row.externalId,
          header: ({ column }: never) => <DataGridColumnHeader title="External ID" column={column} />,
          cell: ({ row }: { row: { original: Customer } }) =>
            row.original.externalId ? (
              <span className="truncate font-mono text-xs text-muted-foreground">
                {row.original.externalId}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          enableSorting: true,
          size: 180,
        },
        {
          id: 'country',
          meta: { skeleton: <Skeleton className="h-4 w-10" /> },
          accessorFn: (row: Customer) => row.addressCountry,
          header: ({ column }: never) => <DataGridColumnHeader title="Country" column={column} />,
          cell: ({ row }: { row: { original: Customer } }) =>
            row.original.addressCountry ? (
              <span className="tabular-nums">{row.original.addressCountry.toUpperCase()}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          enableSorting: true,
          size: 120,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Customer) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Customer } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: true,
          size: 120,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Customer) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Customer } }) => (
            <DateCell value={row.original.createdAt} {...(locale ? { locale } : {})} />
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
    data: customers,
    columns,
    // Server-side: `data` is exactly one page, so the grid must not re-page it.
    // `rowCount` is what makes getPageCount() correct.
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Customer) => row.id,
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
        heading="Customers"
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        placeholder="Search customers…"
        label="Search customers"
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
            title="No customers match these filters"
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
        {...(onCustomerClick ? { onRowClick: onCustomerClick } : {})}
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
        {/* ReUI's DataGridScrollArea puts `className` on an inner node, so its
            own root div never becomes the flex-1 item — it sizes to content and
            the footer below is pushed off-screen once the list is taller than
            the viewport. This wrapper makes the root (`> div`) the flex child
            that fills and scrolls, keeping the pagination pinned in view. */}
        <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
          <DataGridScrollArea className="min-h-0 flex-1">
            <DataGridTable />
          </DataGridScrollArea>
        </div>
        <GridFooter
          fitToWindow={fitToWindow}
          onFitToWindowChange={setFitToWindow}
          pageSize={query.pageSize}
          noun="customers"
        />
      </DataGrid>
    </div>
  )
}
