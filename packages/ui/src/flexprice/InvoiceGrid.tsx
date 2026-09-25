import { useMemo } from 'react'
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import {
  type Invoice,
  type InvoiceQuery,
  InvoiceSortField,
} from '@fp/domain'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@ui/components/reui/data-grid/data-grid-pagination'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { useRef, useState } from 'react'
import { Button } from '@ui/primitives/button'
import { Skeleton } from '@ui/primitives/skeleton'
import { FitToWindow } from '@ui/compositions/FitToWindow'
import { SortMenu } from '@ui/compositions/SortMenu'
import { useViewportPageSize } from '@ui/compositions/useViewportPageSize'
import { Money } from './Money'
import { provenance } from '@ui/provenance'
import { InvoiceStatusBadge } from './StatusBadge'

/**
 * The invoice list, as a *controlled* grid.
 *
 * Every ReUI data-grid example owns `useState` for pagination and sorting and
 * runs its own fetch effect. That is the right shape for a demo and the wrong
 * shape for this codebase: it is precisely how V1 arrived at 55 bespoke table
 * components, each with its own private copy of paging, filtering and
 * fetching, none of them shareable and none of them linkable.
 *
 * So this component holds **no state and performs no fetching**. It receives a
 * `query` and emits `onQueryChange`; the page owns that query and keeps it in
 * the URL. The consequences are the point:
 *
 *   - a sorted, filtered, paged view is a link somebody can send
 *   - back/forward work, and a refresh lands where you were
 *   - every state — loading, empty, error — is reachable from props, so it can
 *     be a story and a test rather than something you provoke a server into
 *   - an agent can construct the view it means by building a URL
 *
 * It also cannot import `@fp/query`; ESLint forbids it. That constraint is what
 * makes the above true rather than merely intended.
 */
export const InvoiceGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge'],
  note: 'Controlled wrapper: the page owns query state, the grid only renders and reports intent.',
})

export interface InvoiceGridProps {
  invoices: Invoice[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: InvoiceQuery
  onQueryChange: (query: InvoiceQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onInvoiceClick?: (invoice: Invoice) => void
  /** Locale for money and dates. Supplied by the app, never read from a global. */
  locale?: string
}

/**
 * Status colour, from ReUI's own Badge variants — not hand-picked classes.
 *
 * Only `overdue` is destructive. If several statuses shout, none of them does,
 * and the one row a billing operator has to act on stops standing out.
 */

/**
 * The `-light` variants, not the solid ones.
 *
 * Not a taste call — the a11y check failed on the solid badges. White text on
 * `success` measured 2.47:1 and on `info` 4.4:1 at this size, against the 4.5:1
 * AA threshold. The light variants put dark text on a tinted background and
 * clear it comfortably, which is also the right density for a table: a row of
 * saturated pills competes with the data it is annotating.
 */
/** Column ids are the domain sort fields, so the two cannot drift apart. */
const SORTABLE: Record<string, InvoiceSortField> = {
  issuedAt: InvoiceSortField.IssuedAt,
  dueDate: InvoiceSortField.DueDate,
  total: InvoiceSortField.Total,
  status: InvoiceSortField.Status,
}

/**
 * The same four fields the columns offer, for the menu.
 *
 * Derived from `SORTABLE` rather than written again, so a column that becomes
 * sortable cannot be missing from the menu — or the other way round.
 */
const SORT_LABEL: Record<InvoiceSortField, string> = {
  [InvoiceSortField.IssuedAt]: 'Issued',
  [InvoiceSortField.DueDate]: 'Due',
  [InvoiceSortField.Total]: 'Total',
  [InvoiceSortField.Status]: 'Status',
}

const SORT_OPTIONS = Object.values(SORTABLE).map((value) => ({
  value,
  label: SORT_LABEL[value],
}))

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

export function InvoiceGrid({
  invoices,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onInvoiceClick,
  locale,
}: InvoiceGridProps) {
  const columns = useMemo<ColumnDef<never, Invoice>[]>(
    () =>
      [
        {
          id: 'number',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Invoice) => row.number,
          header: ({ column }: never) => <DataGridColumnHeader title="Invoice" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => (
            <span className="font-medium tabular-nums">{row.original.number}</span>
          ),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'customer',
          meta: { skeleton: <Skeleton className="h-4 w-36" /> },
          accessorFn: (row: Invoice) => row.customerName,
          header: ({ column }: never) => <DataGridColumnHeader title="Customer" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => row.original.customerName,
          enableSorting: false,
          size: 220,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Invoice) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => (
            <InvoiceStatusBadge status={row.original.status} />
          ),
          size: 120,
        },
        {
          id: 'total',
          meta: { skeleton: <Skeleton className="ml-auto h-4 w-20" /> },
          accessorFn: (row: Invoice) => row.total.amount,
          header: ({ column }: never) => <DataGridColumnHeader title="Total" column={column} />,
          // Money is formatted from the exact decimal; it never becomes a float.
          cell: ({ row }: { row: { original: Invoice } }) => (
            <Money value={row.original.total} {...(locale ? { locale } : {})} truncate />
          ),
          size: 140,
        },
        {
          id: 'dueDate',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Invoice) => row.dueDate,
          header: ({ column }: never) => <DataGridColumnHeader title="Due" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => formatDate(row.original.dueDate, locale),
          size: 140,
        },
        {
          id: 'issuedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Invoice) => row.issuedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Issued" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => formatDate(row.original.issuedAt, locale),
          size: 140,
        },
      ] as never,
    [locale],
  )

  // TanStack's state, derived from the query rather than stored beside it.
  // One source of truth: change the URL and the grid follows.
  const pagination: PaginationState = {
    pageIndex: query.page - 1,
    pageSize: query.pageSize,
  }
  const sorting: SortingState = [{ id: query.sortBy, desc: query.sortDirection === 'desc' }]

  const table = useTable({
    features: dataGridFeatures,
    data: invoices,
    columns,
    // Server-side: `data` is exactly one page, so the grid must not re-page or
    // re-sort it. `rowCount` is what makes getPageCount() correct.
    manualPagination: true,
    manualSorting: true,
    rowCount: total,
    getRowId: (row: Invoice) => row.id,
    state: { pagination, sorting },
    onPaginationChange: (updater: unknown) => {
      const next = typeof updater === 'function' ? (updater as (p: PaginationState) => PaginationState)(pagination) : (updater as PaginationState)
      onQueryChange({ ...query, page: next.pageIndex + 1, pageSize: next.pageSize })
    },
    onSortingChange: (updater: unknown) => {
      const next = typeof updater === 'function' ? (updater as (s: SortingState) => SortingState)(sorting) : (updater as SortingState)
      const first = next[0]
      if (!first) return
      const sortBy = SORTABLE[first.id]
      if (!sortBy) return
      // Re-sorting returns to page 1: staying on page 7 of a different order
      // shows rows the user did not ask for and cannot explain.
      onQueryChange({ ...query, sortBy, sortDirection: first.desc ? 'desc' : 'asc', page: 1 })
    },
  } as never)

  /*
   * Measured paging. Hooks run before the error branch below, because a
   * component may not change how many hooks it calls between renders — and an
   * error is exactly when that would otherwise happen.
   */
  const containerRef = useRef<HTMLDivElement>(null)
  const [fitToWindow, setFitToWindow] = useState(false)
  const capacity = useViewportPageSize({
    containerRef,
    enabled: fitToWindow,
    // The toolbar above and the pagination footer below are not rows.
    reservedHeight: 96,
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
      <div className="flex items-center gap-1">
        <SortMenu
          options={SORT_OPTIONS}
          field={query.sortBy}
          direction={query.sortDirection}
          onChange={(sortBy, sortDirection) =>
            onQueryChange({ ...query, sortBy, sortDirection, page: 1 })
          }
        />
        <div className="ml-auto">
          <FitToWindow pressed={fitToWindow} onPressedChange={setFitToWindow} />
        </div>
      </div>

      <DataGrid
        table={table as never}
        recordCount={total}
        isLoading={isLoading}
        emptyMessage="No invoices match these filters."
        {...(onInvoiceClick ? { onRowClick: onInvoiceClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          width: 'fixed',
          /*
           * No horizontal rules, and tighter rows. Removing the lines is most
           * of what makes a dense ledger read quietly — rows separate by
           * rhythm and alignment, which is enough once every column is
           * aligned. The rules only earn their place when rows wrap.
           */
          rowBorder: false,
          dense: true,
        }}
      >
        <DataGridTable />
        <DataGridPagination />
      </DataGrid>
    </div>
  )
}
