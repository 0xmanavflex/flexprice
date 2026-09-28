import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  SUBSCRIPTION_SORT_LABEL,
  type Subscription,
  type SubscriptionQuery,
  SubscriptionSortField,
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
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

/**
 * The subscription list, as a *controlled* grid.
 *
 * The same table-only shape as `InvoiceGrid` — a billing ledger reads as one
 * dense table, not as a wall of cards — with the `GridToolbar` search and
 * `filters` slot the catalogue grids carry. It holds no state and performs no
 * fetching: it receives a `query` and emits `onQueryChange`, so a sorted,
 * filtered, paged view is a link, and every state is reachable from props.
 */
export const SubscriptionGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge'],
  note: 'Controlled wrapper: the page owns query state, the grid only renders and reports intent.',
})

const SORT_OPTIONS = Object.values(SubscriptionSortField).map((value) => ({
  value,
  label: SUBSCRIPTION_SORT_LABEL[value],
}))

export interface SubscriptionGridProps {
  subscriptions: Subscription[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: SubscriptionQuery
  onQueryChange: (query: SubscriptionQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onSubscriptionClick?: (subscription: Subscription) => void
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

export function SubscriptionGrid({
  subscriptions,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onSubscriptionClick,
  filters,
  onClearFilters,
  locale,
}: SubscriptionGridProps) {
  const columns = useMemo<ColumnDef<never, Subscription>[]>(
    () =>
      [
        {
          id: 'customer',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: Subscription) => row.customerName,
          header: ({ column }: never) => <DataGridColumnHeader title="Customer" column={column} />,
          cell: ({ row }: { row: { original: Subscription } }) => (
            <span className="truncate font-medium">{row.original.customerName}</span>
          ),
          enableSorting: false,
          size: 240,
        },
        {
          id: 'plan',
          meta: { skeleton: <Skeleton className="h-4 w-32" /> },
          accessorFn: (row: Subscription) => row.planName,
          header: ({ column }: never) => <DataGridColumnHeader title="Plan" column={column} />,
          cell: ({ row }: { row: { original: Subscription } }) => (
            <span className="truncate text-muted-foreground">{row.original.planName}</span>
          ),
          enableSorting: false,
          size: 200,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-20 rounded-full" /> },
          accessorFn: (row: Subscription) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Subscription } }) => (
            <SubscriptionStatusBadge status={row.original.status} />
          ),
          enableSorting: false,
          size: 130,
        },
        {
          id: 'billingPeriod',
          meta: { skeleton: <Skeleton className="h-4 w-20" /> },
          accessorFn: (row: Subscription) => row.billingPeriodLabel,
          header: ({ column }: never) => (
            <DataGridColumnHeader title="Billing period" column={column} />
          ),
          cell: ({ row }: { row: { original: Subscription } }) => (
            <span className="text-muted-foreground">{row.original.billingPeriodLabel}</span>
          ),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'currentPeriodEnd',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Subscription) => row.currentPeriodEnd,
          header: ({ column }: never) => <DataGridColumnHeader title="Renews" column={column} />,
          cell: ({ row }: { row: { original: Subscription } }) =>
            formatDate(row.original.currentPeriodEnd, locale),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'startDate',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Subscription) => row.startDate,
          header: ({ column }: never) => <DataGridColumnHeader title="Started" column={column} />,
          cell: ({ row }: { row: { original: Subscription } }) =>
            formatDate(row.original.startDate, locale),
          enableSorting: false,
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

  const table = useTable({
    features: dataGridFeatures,
    data: subscriptions,
    columns,
    // Server-side: `data` is exactly one page, so the grid must not re-page it.
    // `rowCount` is what makes getPageCount() correct.
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Subscription) => row.id,
    state: { pagination },
    onPaginationChange: (updater: unknown) => {
      const next =
        typeof updater === 'function'
          ? (updater as (p: PaginationState) => PaginationState)(pagination)
          : (updater as PaginationState)
      onQueryChange({ ...query, page: next.pageIndex + 1, pageSize: next.pageSize })
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
        placeholder="Search…"
        label="Search subscriptions"
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
            title="No subscriptions match these filters"
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
        {...(onSubscriptionClick ? { onRowClick: onSubscriptionClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          // Auto, so the columns spread to fill the width instead of leaving a
          // band of empty table on the right. The `size` hints still set the
          // proportions; the name cells truncate so a long value cannot blow a
          // column out.
          width: 'auto',
          /*
           * No horizontal rules, and tighter rows — the same quiet ledger the
           * invoice grid uses. Rows separate by rhythm and alignment once every
           * column is aligned.
           */
          rowBorder: false,
          dense: true,
        }}
      >
        {/* Bounded scroll region so the pagination footer below stays pinned in
            view. The wrapper makes ReUI's scroll-area root the flex-1 item — its
            className lands on an inner node — so it shrinks and scrolls instead
            of pushing the footer off-screen on a tall list. */}
        <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
          <DataGridScrollArea className="min-h-0 flex-1">
            <DataGridTable />
          </DataGridScrollArea>
        </div>
        <GridFooter
          fitToWindow={fitToWindow}
          onFitToWindowChange={setFitToWindow}
          pageSize={query.pageSize}
          noun="subscriptions"
        />
      </DataGrid>
    </div>
  )
}
