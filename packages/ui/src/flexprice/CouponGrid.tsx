import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  COUPON_CADENCE_LABEL,
  COUPON_SORT_LABEL,
  type Coupon,
  type CouponQuery,
  CouponCadence,
  CouponSortField,
  CouponType,
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
import { Money } from './Money'
import { CatalogStatusBadge } from './StatusBadge'

/**
 * The coupon list.
 *
 * The same controlled table shape as `AddonGrid`, with a coupon's own
 * columns: the discount (a `Money` when fixed, a percentage when not), how long
 * it lasts, and how far its redemptions have run against the ceiling. Filtering
 * is passed in through the `filters` slot.
 */
export const CouponGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid'],
  note: 'Controlled wrapper; the page owns query state. A dense table over one query.',
})

const SORT_OPTIONS = Object.values(CouponSortField).map((value) => ({
  value,
  label: COUPON_SORT_LABEL[value],
}))

export interface CouponGridProps {
  coupons: Coupon[]
  total: number
  query: CouponQuery
  onQueryChange: (query: CouponQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onCouponClick?: (coupon: Coupon) => void
  /** The primary create action; renders a "New coupon" CTA at the toolbar's end. */
  onCreate?: () => void
  filters?: ReactNode
  onClearFilters?: () => void
  locale?: string
}

/** A date, de-emphasised: secondary metadata reads as muted, tabular figures. */
function DateCell({ value, locale }: { value: Date | null; locale?: string }): ReactNode {
  const text = value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : '—'
  return <span className="tabular-nums text-muted-foreground">{text}</span>
}

/** The discount, drawn from whichever of the two fields the type populates. */
function DiscountCell({ coupon, locale }: { coupon: Coupon; locale?: string | undefined }) {
  if (coupon.type === CouponType.Percentage) {
    return <span className="tabular-nums">{coupon.percentageOff ?? '0'}%</span>
  }
  return coupon.amountOff ? (
    <Money value={coupon.amountOff} {...(locale ? { locale } : {})} />
  ) : (
    <span>—</span>
  )
}

/** "One-time", "Forever", or "Repeating · 3 periods". */
function durationLabel(coupon: Coupon): string {
  if (coupon.cadence === CouponCadence.Repeated && coupon.durationInPeriods) {
    const unit = coupon.durationInPeriods === 1 ? 'period' : 'periods'
    return `${COUPON_CADENCE_LABEL[coupon.cadence]} · ${coupon.durationInPeriods} ${unit}`
  }
  return COUPON_CADENCE_LABEL[coupon.cadence]
}

/** "213 / 500", or "87 / ∞" when redemptions are unlimited. */
function redemptionsLabel(coupon: Coupon, locale?: string): string {
  const format = (n: number) => new Intl.NumberFormat(locale).format(n)
  const cap = coupon.maxRedemptions === null ? '∞' : format(coupon.maxRedemptions)
  return `${format(coupon.totalRedemptions)} / ${cap}`
}

export function CouponGrid({
  coupons,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onCouponClick,
  onCreate,
  filters,
  onClearFilters,
  locale,
}: CouponGridProps) {
  const columns = useMemo<ColumnDef<never, Coupon>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: Coupon) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Coupon" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
            <div className="flex min-w-0 flex-col">
              <span className="truncate">{row.original.name}</span>
              {row.original.code ? (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {row.original.code}
                </span>
              ) : null}
            </div>
          ),
          enableSorting: true,
          size: 260,
        },
        {
          id: 'discount',
          meta: { skeleton: <Skeleton className="h-4 w-16" /> },
          accessorFn: (row: Coupon) => (row.type === CouponType.Percentage ? row.percentageOff : row.amountOff?.amount),
          header: ({ column }: never) => <DataGridColumnHeader title="Discount" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
            <span className="tabular-nums">
              <DiscountCell coupon={row.original} locale={locale} />
            </span>
          ),
          enableSorting: true,
          size: 120,
        },
        {
          id: 'duration',
          meta: { skeleton: <Skeleton className="h-4 w-28" /> },
          accessorFn: (row: Coupon) => row.cadence,
          header: ({ column }: never) => <DataGridColumnHeader title="Duration" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
            <span className="text-muted-foreground">{durationLabel(row.original)}</span>
          ),
          enableSorting: true,
          size: 180,
        },
        {
          id: 'redemptions',
          meta: { skeleton: <Skeleton className="h-4 w-16" /> },
          accessorFn: (row: Coupon) => row.totalRedemptions,
          header: ({ column }: never) => <DataGridColumnHeader title="Redemptions" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
            <span className="tabular-nums text-muted-foreground">
              {redemptionsLabel(row.original, locale)}
            </span>
          ),
          enableSorting: true,
          size: 140,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Coupon) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: true,
          size: 120,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Coupon) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
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
    data: coupons,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Coupon) => row.id,
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
        heading="Coupons"
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        placeholder="Search coupons…"
        label="Search coupons"
        action={
          onCreate ? (
            <Button size="sm" onClick={onCreate}>
              New coupon
            </Button>
          ) : undefined
        }
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
            title="No coupons match these filters"
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
        {...(onCouponClick ? { onRowClick: onCouponClick } : {})}
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
        {/* The table scrolls within a bounded region so the pagination footer
            below stays pinned in view instead of being pushed off the bottom
            when the list is taller than the screen.

            ReUI's DataGridScrollArea puts `className` on an inner node, so its
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
          noun="coupons"
        />
      </DataGrid>
    </div>
  )
}
