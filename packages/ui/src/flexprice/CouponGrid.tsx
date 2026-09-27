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
  CouponView,
} from '@fp/domain'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { Button } from '@ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/primitives/card'
import { Skeleton } from '@ui/primitives/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@ui/primitives/tabs'
import { LayoutGridIcon, TableIcon } from 'lucide-react'
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
 * The same controlled table/cards shape as `AddonGrid`, with a coupon's own
 * columns: the discount (a `Money` when fixed, a percentage when not), how long
 * it lasts, and how far its redemptions have run against the ceiling. Filtering
 * is passed in through the `filters` slot.
 */
export const CouponGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', 'ui/card', 'ui/tabs'],
  note: 'Controlled wrapper; the page owns query state. Table and cards over one query.',
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
  filters?: ReactNode
  onClearFilters?: () => void
  locale?: string
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
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
          id: 'discount',
          meta: { skeleton: <Skeleton className="ml-auto h-4 w-16" />, headerClassName: 'text-right [&>div]:justify-end' },
          accessorFn: (row: Coupon) => (row.type === CouponType.Percentage ? row.percentageOff : row.amountOff?.amount),
          header: ({ column }: never) => <DataGridColumnHeader title="Discount" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
            <div className="text-right tabular-nums">
              <DiscountCell coupon={row.original} locale={locale} />
            </div>
          ),
          enableSorting: false,
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
          enableSorting: false,
          size: 180,
        },
        {
          id: 'redemptions',
          meta: { skeleton: <Skeleton className="ml-auto h-4 w-16" />, headerClassName: 'text-right [&>div]:justify-end' },
          accessorFn: (row: Coupon) => row.totalRedemptions,
          header: ({ column }: never) => <DataGridColumnHeader title="Redemptions" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => (
            <div className="text-right tabular-nums text-muted-foreground">
              {redemptionsLabel(row.original, locale)}
            </div>
          ),
          enableSorting: false,
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
          enableSorting: false,
          size: 120,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Coupon) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Coupon } }) => formatDate(row.original.updatedAt, locale),
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
    enabled: fitToWindow && query.view === CouponView.Table,
    reservedHeight: 104,
  })

  if (fitToWindow && query.view === CouponView.Table && capacity !== null && capacity !== query.pageSize) {
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
        label="Search coupons"
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
        <Tabs
          value={query.view}
          onValueChange={(view) => onQueryChange({ ...query, view: view as CouponView })}
        >
          <TabsList>
            <TabsTrigger value={CouponView.Table} aria-label="Table view">
              <TableIcon aria-hidden />
            </TabsTrigger>
            <TabsTrigger value={CouponView.Cards} aria-label="Card view">
              <LayoutGridIcon aria-hidden />
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
        {query.view === CouponView.Cards ? (
          <CouponCards
            coupons={coupons}
            isLoading={isLoading}
            onCouponClick={onCouponClick}
            onClearFilters={onClearFilters}
            locale={locale}
          />
        ) : (
          <DataGridTable />
        )}
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

interface CouponCardsProps {
  coupons: Coupon[]
  isLoading: boolean
  onCouponClick?: ((coupon: Coupon) => void) | undefined
  onClearFilters?: (() => void) | undefined
  locale?: string | undefined
}

function CouponCards({ coupons, isLoading, onCouponClick, onClearFilters, locale }: CouponCardsProps) {
  if (isLoading && coupons.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (coupons.length === 0) {
    return (
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
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {coupons.map((coupon) => {
        const clickable = Boolean(onCouponClick)
        return (
          <Card
            key={coupon.id}
            size="sm"
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onCouponClick?.(coupon) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onCouponClick?.(coupon)
                    }
                  }
                : undefined
            }
            className={
              clickable
                ? 'cursor-pointer transition hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                : undefined
            }
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <CardTitle className="truncate">{coupon.name}</CardTitle>
                  {coupon.code ? (
                    <CardDescription className="truncate font-mono text-xs">
                      {coupon.code}
                    </CardDescription>
                  ) : null}
                </div>
                <CatalogStatusBadge status={coupon.status} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <CouponDetail label="Discount">
                <DiscountCell coupon={coupon} locale={locale} />
              </CouponDetail>
              <CouponDetail label="Duration">{durationLabel(coupon)}</CouponDetail>
              <CouponDetail label="Redemptions">
                <span className="tabular-nums">{redemptionsLabel(coupon, locale)}</span>
              </CouponDetail>
              <CouponDetail label="Updated">{formatDate(coupon.updatedAt, locale)}</CouponDetail>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function CouponDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
