import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import { type Payment, type PaymentQuery } from '@fp/domain'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@ui/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { Button } from '@ui/primitives/button'
import { Skeleton } from '@ui/primitives/skeleton'
import { EmptyState } from '@ui/compositions/EmptyState'
import { GridFooter } from '@ui/compositions/GridFooter'
import { GridToolbar } from '@ui/compositions/GridToolbar'
import { useViewportPageSize } from '@ui/compositions/useViewportPageSize'
import { provenance } from '@ui/provenance'
import { Money } from './Money'
import { PaymentStatusBadge } from './PaymentStatusBadge'

/**
 * The payment list, as a *controlled* grid.
 *
 * The same controlled, table-only shape as `InvoiceGrid`: it holds no state and
 * performs no fetching, receiving a `query` and emitting `onQueryChange` so the
 * page can keep that query in the URL. There is no view toggle and there are no
 * cards — a payment is a ledger row, and a row is all it wants to be.
 *
 * Search and the status filter (through the `filters` slot) narrow the list the
 * same way the catalogue grids do; the amount is a `Money`, so the column is
 * exact and never a float.
 */
export const PaymentGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge'],
  note: 'Controlled wrapper: the page owns query state, the grid only renders and reports intent.',
})

export interface PaymentGridProps {
  payments: Payment[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: PaymentQuery
  onQueryChange: (query: PaymentQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onPaymentClick?: (payment: Payment) => void
  /** The advanced filter, dropped into the toolbar. */
  filters?: ReactNode
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Locale for money and dates. Supplied by the app, never read from a global. */
  locale?: string
}

/** A date, de-emphasised: secondary metadata reads as muted, tabular figures. */
function DateCell({ value, locale }: { value: Date | null; locale?: string }): ReactNode {
  const text = value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : '—'
  return <span className="text-muted-foreground tabular-nums">{text}</span>
}

export function PaymentGrid({
  payments,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPaymentClick,
  filters,
  onClearFilters,
  locale,
}: PaymentGridProps) {
  const columns = useMemo<ColumnDef<never, Payment>[]>(
    () =>
      [
        {
          id: 'amount',
          meta: {
            skeleton: <Skeleton className="ml-auto h-4 w-20" />,
            headerClassName: 'text-right [&>div]:justify-end',
          },
          accessorFn: (row: Payment) => row.amount.amount,
          header: ({ column }: never) => <DataGridColumnHeader title="Amount" column={column} />,
          // Money is formatted from the exact decimal; it never becomes a float.
          // Right-aligned with tabular figures so a column of amounts lines up on
          // the decimal and scans as money rather than as text.
          cell: ({ row }: { row: { original: Payment } }) => (
            <div className="text-right tabular-nums">
              <Money value={row.original.amount} {...(locale ? { locale } : {})} truncate />
            </div>
          ),
          enableSorting: true,
          size: 140,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Payment) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Payment } }) => (
            <PaymentStatusBadge status={row.original.status} />
          ),
          enableSorting: true,
          size: 130,
        },
        {
          id: 'method',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Payment) => row.methodType,
          header: ({ column }: never) => <DataGridColumnHeader title="Method" column={column} />,
          cell: ({ row }: { row: { original: Payment } }) => (
            <span className="text-muted-foreground">{row.original.methodType || '—'}</span>
          ),
          enableSorting: true,
          size: 160,
        },
        {
          id: 'invoice',
          meta: { skeleton: <Skeleton className="h-4 w-28" /> },
          accessorFn: (row: Payment) => row.invoiceNumber,
          header: ({ column }: never) => <DataGridColumnHeader title="Invoice" column={column} />,
          cell: ({ row }: { row: { original: Payment } }) =>
            row.original.invoiceNumber ? (
              <span className="font-mono text-xs">{row.original.invoiceNumber}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          enableSorting: true,
          size: 160,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Payment) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Date" column={column} />,
          cell: ({ row }: { row: { original: Payment } }) => (
            <DateCell value={row.original.createdAt} {...(locale ? { locale } : {})} />
          ),
          enableSorting: true,
          size: 140,
        },
      ] as never,
    [locale],
  )

  // TanStack's state, derived from the query rather than stored beside it.
  const pagination: PaginationState = {
    pageIndex: query.page - 1,
    pageSize: query.pageSize,
  }

  const table = useTable({
    features: dataGridFeatures,
    data: payments,
    columns,
    // Server-side: `data` is exactly one page, so the grid must not re-page it.
    // `rowCount` is what makes getPageCount() correct.
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Payment) => row.id,
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
        heading="Payments"
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        placeholder="Search payments…"
        label="Search payments"
      >
        {filters}
      </GridToolbar>

      <DataGrid
        table={table as never}
        recordCount={total}
        isLoading={isLoading}
        emptyMessage={
          <EmptyState
            size="inline"
            isFiltered
            title="No payments match these filters"
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
        {...(onPaymentClick ? { onRowClick: onPaymentClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          // Auto, so the columns spread to fill the width instead of leaving a
          // band of empty table on the right.
          width: 'auto',
          rowBorder: false,
          dense: true,
        }}
      >
        {/* ReUI's DataGridScrollArea puts `className` on an inner node, so this
            wrapper makes the root (`> div`) the flex child that fills and
            scrolls, keeping the pagination footer pinned in view when the list
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
          noun="payments"
        />
      </DataGrid>
    </div>
  )
}
