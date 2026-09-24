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
  InvoiceStatus,
  formatMoney,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@ui/components/reui/data-grid/data-grid-pagination'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { Button } from '@ui/primitives/button'
import { provenance } from '@ui/provenance'

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
type BadgeVariant = 'secondary' | 'info-light' | 'success-light' | 'destructive-light'

/**
 * The `-light` variants, not the solid ones.
 *
 * Not a taste call — the a11y check failed on the solid badges. White text on
 * `success` measured 2.47:1 and on `info` 4.4:1 at this size, against the 4.5:1
 * AA threshold. The light variants put dark text on a tinted background and
 * clear it comfortably, which is also the right density for a table: a row of
 * saturated pills competes with the data it is annotating.
 */
const STATUS_VARIANT: Record<InvoiceStatus, BadgeVariant> = {
  [InvoiceStatus.Draft]: 'secondary',
  [InvoiceStatus.Open]: 'info-light',
  [InvoiceStatus.Paid]: 'success-light',
  [InvoiceStatus.Overdue]: 'destructive-light',
  [InvoiceStatus.Void]: 'secondary',
  [InvoiceStatus.Skipped]: 'secondary',
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Open]: 'Open',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Overdue]: 'Overdue',
  [InvoiceStatus.Void]: 'Void',
  [InvoiceStatus.Skipped]: 'Skipped',
}

/** Column ids are the domain sort fields, so the two cannot drift apart. */
const SORTABLE: Record<string, InvoiceSortField> = {
  issuedAt: InvoiceSortField.IssuedAt,
  dueDate: InvoiceSortField.DueDate,
  total: InvoiceSortField.Total,
  status: InvoiceSortField.Status,
}

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
          accessorFn: (row: Invoice) => row.customerName,
          header: ({ column }: never) => <DataGridColumnHeader title="Customer" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => row.original.customerName,
          enableSorting: false,
          size: 220,
        },
        {
          id: 'status',
          accessorFn: (row: Invoice) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => (
            <Badge variant={STATUS_VARIANT[row.original.status]} size="sm">
              {STATUS_LABEL[row.original.status]}
            </Badge>
          ),
          size: 120,
        },
        {
          id: 'total',
          accessorFn: (row: Invoice) => row.total.amount,
          header: ({ column }: never) => <DataGridColumnHeader title="Total" column={column} />,
          // Money is formatted from the exact decimal; it never becomes a float.
          cell: ({ row }: { row: { original: Invoice } }) => (
            <span className="tabular-nums">{formatMoney(row.original.total, locale)}</span>
          ),
          size: 140,
        },
        {
          id: 'dueDate',
          accessorFn: (row: Invoice) => row.dueDate,
          header: ({ column }: never) => <DataGridColumnHeader title="Due" column={column} />,
          cell: ({ row }: { row: { original: Invoice } }) => formatDate(row.original.dueDate, locale),
          size: 140,
        },
        {
          id: 'issuedAt',
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
    <DataGrid
      table={table as never}
      recordCount={total}
      isLoading={isLoading}
      emptyMessage="No invoices match these filters."
      {...(onInvoiceClick ? { onRowClick: onInvoiceClick } : {})}
      tableLayout={{ headerSticky: true, columnsVisibility: true, width: 'fixed' }}
    >
      <DataGridTable />
      <DataGridPagination />
    </DataGrid>
  )
}
