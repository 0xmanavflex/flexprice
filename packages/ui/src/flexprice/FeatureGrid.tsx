import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  AGGREGATION_LABEL,
  FEATURE_SORT_LABEL,
  type Feature,
  type FeatureQuery,
  FeatureSortField,
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
import { CatalogStatusBadge, FeatureTypeBadge } from './StatusBadge'

/**
 * The feature list.
 *
 * Controlled like `InvoiceGrid`: the route owns the query, this renders it and
 * reports intent. A dense table over that query. Every column is a single
 * value: the type and status are the shared catalogue badge (`@reui/badge`,
 * colour on the glyph), never a coloured fill, and no cell stacks a heading
 * over a subheading.
 */
export const FeatureGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid'],
  note: 'Controlled wrapper; the page owns query state. Single-value columns, shared badges.',
})

const SORT_OPTIONS = Object.values(FeatureSortField).map((value) => ({
  value,
  label: FEATURE_SORT_LABEL[value],
}))

export interface FeatureGridProps {
  features: Feature[]
  total: number
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onFeatureClick?: (feature: Feature) => void
  /** The primary create action; renders a "New feature" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Filter controls, rendered beside Sort. */
  filters?: ReactNode
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

/** A date, de-emphasised: secondary metadata reads as muted, tabular figures. */
function DateCell({ value, locale }: { value: Date | null; locale?: string }): ReactNode {
  const text = value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : '—'
  return <span className="tabular-nums text-muted-foreground">{text}</span>
}

/** One value: how usage is aggregated. An em dash where nothing is measured. */
function measuredBy(feature: Feature): ReactNode {
  if (!feature.aggregationType) return <span className="text-muted-foreground">—</span>
  return AGGREGATION_LABEL[feature.aggregationType]
}

export function FeatureGrid({
  features,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onFeatureClick,
  onCreate,
  filters,
  onClearFilters,
  locale,
}: FeatureGridProps) {
  const columns = useMemo<ColumnDef<never, Feature>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: Feature) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Feature" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => (
            <span className="block truncate">{row.original.name}</span>
          ),
          enableSorting: true,
          size: 240,
        },
        {
          id: 'type',
          meta: { skeleton: <Skeleton className="h-5 w-20 rounded-full" /> },
          accessorFn: (row: Feature) => row.type,
          header: ({ column }: never) => <DataGridColumnHeader title="Type" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => (
            <FeatureTypeBadge type={row.original.type} />
          ),
          enableSorting: true,
          size: 130,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-5 w-24 rounded-full" /> },
          accessorFn: (row: Feature) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: true,
          size: 140,
        },
        {
          id: 'measurement',
          meta: { skeleton: <Skeleton className="h-4 w-32" /> },
          accessorFn: (row: Feature) => row.aggregationType,
          header: ({ column }: never) => (
            <DataGridColumnHeader title="Measured by" column={column} />
          ),
          cell: ({ row }: { row: { original: Feature } }) => measuredBy(row.original),
          enableSorting: true,
          size: 200,
        },
        {
          id: 'unit',
          meta: { skeleton: <Skeleton className="h-4 w-16" /> },
          accessorFn: (row: Feature) => row.unitSingular,
          header: ({ column }: never) => <DataGridColumnHeader title="Unit" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) =>
            row.original.unitSingular ? (
              row.original.unitSingular
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          enableSorting: true,
          size: 110,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Feature) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => (
            <DateCell value={row.original.createdAt} {...(locale ? { locale } : {})} />
          ),
          enableSorting: true,
          size: 130,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Feature) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => (
            <DateCell value={row.original.updatedAt} {...(locale ? { locale } : {})} />
          ),
          enableSorting: true,
          size: 130,
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
    data: features,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Feature) => row.id,
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
  // On by default: a list page fills its region and the pagination footer sits
  // just below the last row, rather than the page size overflowing the viewport.
  const [fitToWindow, setFitToWindow] = useState(true)
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
        heading="Features"
        search={query.search}
        onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
        placeholder="Search..."
        label="Search features"
        action={
          onCreate ? (
            <Button size="sm" onClick={onCreate}>
              New feature
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
            title="No features match these filters"
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
        {...(onFeatureClick ? { onRowClick: onFeatureClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          // Auto, so columns fill the width rather than leaving an empty band on
          // the right; the name cell truncates so a long value stays contained.
          width: 'auto',
          rowBorder: false,
          dense: true,
        }}
      >
        {/* Wrapper makes ReUI's scroll-area root the flex-1 item (its className
            lands on an inner node), so it shrinks and scrolls rather than
            pushing the pagination off-screen on a tall list. */}
        <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
          <DataGridScrollArea className="min-h-0 flex-1">
            <DataGridTable />
          </DataGridScrollArea>
        </div>
        <GridFooter
          fitToWindow={fitToWindow}
          onFitToWindowChange={setFitToWindow}
          pageSize={query.pageSize}
          noun="features"
        />
      </DataGrid>
    </div>
  )
}
