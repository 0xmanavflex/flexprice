import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  AGGREGATION_LABEL,
  FEATURE_SORT_LABEL,
  FEATURE_TYPE_LABEL,
  type Feature,
  type FeatureQuery,
  FeatureSortField,
  FeatureType,
  FeatureView,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
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

/**
 * The feature list.
 *
 * Replaces V1's `Features.tsx`, which renders a hand-rolled `FlexpriceTable`
 * and owns drawer state for editing. Controlled in the same way `InvoiceGrid`
 * is: the route owns the query, this renders it and reports intent.
 *
 * Two layouts over one query: a dense **table** for scanning many features and
 * a **cards** grid for reading each one's detail. The toggle writes `query.view`,
 * so a chosen layout is part of the shareable URL, not local state. Filtering is
 * not built in — the page passes an advanced `FeatureFilters` builder into the
 * `filters` slot, keeping this component ignorant of what a feature type is.
 */
export const FeatureGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge', 'ui/card', 'ui/tabs'],
  note: 'Controlled wrapper; the page owns query state. Table and cards over one query.',
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

const TYPE_VARIANT: Record<FeatureType, 'info-light' | 'success-light' | 'secondary'> = {
  [FeatureType.Metered]: 'info-light',
  [FeatureType.Boolean]: 'secondary',
  [FeatureType.Static]: 'success-light',
  [FeatureType.Config]: 'secondary',
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

/** How a metered feature is measured, as one line. Empty for the rest. */
function measuredBy(feature: Feature): string | null {
  if (!feature.eventName) return null
  return feature.aggregationType
    ? `${feature.eventName} · ${AGGREGATION_LABEL[feature.aggregationType]}`
    : feature.eventName
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
            <div className="flex flex-col">
              <span className="font-medium">{row.original.name}</span>
              {row.original.lookupKey ? (
                <span className="text-xs text-muted-foreground">{row.original.lookupKey}</span>
              ) : null}
            </div>
          ),
          enableSorting: false,
          size: 240,
        },
        {
          id: 'type',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Feature) => row.type,
          header: ({ column }: never) => <DataGridColumnHeader title="Type" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => (
            <Badge variant={TYPE_VARIANT[row.original.type]} size="sm">
              {FEATURE_TYPE_LABEL[row.original.type]}
            </Badge>
          ),
          enableSorting: false,
          size: 110,
        },
        {
          id: 'measurement',
          meta: { skeleton: <Skeleton className="h-4 w-32" /> },
          accessorFn: (row: Feature) => row.eventName,
          header: ({ column }: never) => (
            <DataGridColumnHeader title="Measured by" column={column} />
          ),
          // Only metered features measure anything; an em dash beats an empty
          // cell, which reads as missing data rather than not applicable.
          cell: ({ row }: { row: { original: Feature } }) => {
            const { eventName, aggregationType } = row.original
            if (!eventName) return <span className="text-muted-foreground">—</span>
            return (
              <div className="flex flex-col">
                <span className="font-mono text-xs">{eventName}</span>
                {aggregationType ? (
                  <span className="text-xs text-muted-foreground">
                    {AGGREGATION_LABEL[aggregationType]}
                  </span>
                ) : null}
              </div>
            )
          },
          enableSorting: false,
          size: 220,
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
          size: 120,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Feature) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) => formatDate(row.original.createdAt, locale),
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
  const [fitToWindow, setFitToWindow] = useState(false)
  const capacity = useViewportPageSize({
    containerRef,
    // Fitting to a window of cards would fight their reflow; only the table has
    // a fixed row height to measure against.
    enabled: fitToWindow && query.view === FeatureView.Table,
    // The toolbar above and the footer below are not rows.
    reservedHeight: 104,
  })

  // `null` means no measurement yet — keep whatever size is already set.
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
        {/* The advanced, V1-style filter builder, passed by the page. */}
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
          /*
           * The table body, not a replacement for the page. A bare sentence
           * leaves someone who just typed a search with nothing to press —
           * and the only useful action here is undoing the thing that emptied
           * the list.
           */
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
        {query.view === FeatureView.Cards ? (
          <FeatureCards
            features={features}
            isLoading={isLoading}
            onFeatureClick={onFeatureClick}
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

/**
 * The same rows as the table, one card each — the layout for reading a feature
 * rather than scanning a column. Loading and the filtered-empty state live here
 * because in this view there is no `DataGridTable` to own them.
 */
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
        const measurement = measuredBy(feature)
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
                <Badge variant={TYPE_VARIANT[feature.type]} size="sm">
                  {FEATURE_TYPE_LABEL[feature.type]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <CardDetail label="Measured by">
                {measurement ? <span className="font-mono text-xs">{measurement}</span> : '—'}
              </CardDetail>
              <CardDetail label="Unit">{feature.unitSingular || '—'}</CardDetail>
              {feature.description ? (
                <CardDetail label="Description">
                  <span className="line-clamp-2">{feature.description}</span>
                </CardDetail>
              ) : null}
              <CardDetail label="Created">{formatDate(feature.createdAt, locale)}</CardDetail>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function CardDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
