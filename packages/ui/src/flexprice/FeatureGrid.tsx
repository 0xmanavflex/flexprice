import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  AGGREGATION_LABEL,
  FEATURE_SORT_LABEL,
  type Feature,
  type FeatureQuery,
  FeatureSortField,
  FeatureView,
} from '@fp/domain'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@ui/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { Button } from '@ui/primitives/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ui/primitives/card'
import { Skeleton } from '@ui/primitives/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@ui/primitives/tabs'
import { LayoutGridIcon, TableIcon } from 'lucide-react'
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
 * reports intent. Two layouts over one query — a dense table and a cards grid.
 * Every column is a single value: the type and status are the shared
 * catalogue badge (`@reui/badge`, colour on the glyph), never a coloured fill,
 * and no cell stacks a heading over a subheading.
 */
export const FeatureGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', 'ui/card', 'ui/tabs'],
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
  /** Filter controls, rendered beside Sort. */
  filters?: ReactNode
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
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
            <span className="block truncate font-medium">{row.original.name}</span>
          ),
          enableSorting: false,
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
          enableSorting: false,
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
          enableSorting: false,
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
          enableSorting: false,
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
          enableSorting: false,
          size: 110,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Feature) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => formatDate(row.original.createdAt, locale),
          enableSorting: false,
          size: 130,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Feature) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => formatDate(row.original.updatedAt, locale),
          enableSorting: false,
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
    enabled: fitToWindow && query.view === FeatureView.Table,
    reservedHeight: 104,
  })

  if (fitToWindow && query.view === FeatureView.Table && capacity !== null && capacity !== query.pageSize) {
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
        label="Search features"
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
          onValueChange={(view) => onQueryChange({ ...query, view: view as FeatureView })}
        >
          <TabsList>
            <TabsTrigger value={FeatureView.Table} aria-label="Table view">
              <TableIcon aria-hidden />
            </TabsTrigger>
            <TabsTrigger value={FeatureView.Cards} aria-label="Card view">
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
        {query.view === FeatureView.Cards ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FeatureCards
              features={features}
              isLoading={isLoading}
              onFeatureClick={onFeatureClick}
              onClearFilters={onClearFilters}
              locale={locale}
            />
          </div>
        ) : (
          // Wrapper makes ReUI's scroll-area root the flex-1 item (its className
          // lands on an inner node), so it shrinks and scrolls rather than
          // pushing the pagination off-screen on a tall list.
          <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col">
            <DataGridScrollArea className="min-h-0 flex-1">
              <DataGridTable />
            </DataGridScrollArea>
          </div>
        )}
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

interface FeatureCardsProps {
  features: Feature[]
  isLoading: boolean
  onFeatureClick?: ((feature: Feature) => void) | undefined
  onClearFilters?: (() => void) | undefined
  locale?: string | undefined
}

/** The same rows as the table, one card each — for reading a feature, not scanning. */
function FeatureCards({
  features,
  isLoading,
  onFeatureClick,
  onClearFilters,
  locale,
}: FeatureCardsProps) {
  if (isLoading && features.length === 0) {
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

  if (features.length === 0) {
    return (
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
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => {
        const clickable = Boolean(onFeatureClick)
        return (
          <Card
            key={feature.id}
            size="sm"
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onFeatureClick?.(feature) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onFeatureClick?.(feature)
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
                  <CardTitle className="truncate">{feature.name}</CardTitle>
                  {feature.lookupKey ? (
                    <CardDescription className="truncate font-mono text-xs">
                      {feature.lookupKey}
                    </CardDescription>
                  ) : null}
                </div>
                <FeatureTypeBadge type={feature.type} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <FeatureCardRow label="Status">
                <CatalogStatusBadge status={feature.status} />
              </FeatureCardRow>
              <FeatureCardRow label="Measured by">{measuredBy(feature)}</FeatureCardRow>
              <FeatureCardRow label="Unit">{feature.unitSingular || '—'}</FeatureCardRow>
              <FeatureCardRow label="Updated">{formatDate(feature.updatedAt, locale)}</FeatureCardRow>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function FeatureCardRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
