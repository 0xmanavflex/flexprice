import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  ADDON_SORT_LABEL,
  type Addon,
  type AddonQuery,
  AddonSortField,
  AddonView,
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
import { CatalogStatusBadge } from './StatusBadge'

/**
 * The add-on list.
 *
 * The same controlled table/cards shape as `PlanGrid`, minus the pricing — an
 * add-on is priced through the charges it shares with a plan, not a headline of
 * its own. Filtering is passed in through the `filters` slot.
 */
export const AddonGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge', 'ui/card', 'ui/tabs'],
  note: 'Controlled wrapper; the page owns query state. Table and cards over one query.',
})

const SORT_OPTIONS = Object.values(AddonSortField).map((value) => ({
  value,
  label: ADDON_SORT_LABEL[value],
}))

export interface AddonGridProps {
  addons: Addon[]
  total: number
  query: AddonQuery
  onQueryChange: (query: AddonQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onAddonClick?: (addon: Addon) => void
  filters?: ReactNode
  onClearFilters?: () => void
  locale?: string
}


function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

export function AddonGrid({
  addons,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onAddonClick,
  filters,
  onClearFilters,
  locale,
}: AddonGridProps) {
  const columns = useMemo<ColumnDef<never, Addon>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: Addon) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Add-on" column={column} />,
          cell: ({ row }: { row: { original: Addon } }) => (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.name}</span>
              {row.original.lookupKey ? (
                <span className="truncate text-xs text-muted-foreground">
                  {row.original.lookupKey}
                </span>
              ) : null}
            </div>
          ),
          enableSorting: false,
          size: 280,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Addon) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Addon } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: false,
          size: 120,
        },
        {
          id: 'createdAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Addon) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Addon } }) => formatDate(row.original.createdAt, locale),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Addon) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Addon } }) => formatDate(row.original.updatedAt, locale),
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
    data: addons,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Addon) => row.id,
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
    enabled: fitToWindow && query.view === AddonView.Table,
    reservedHeight: 104,
  })

  if (fitToWindow && query.view === AddonView.Table && capacity !== null && capacity !== query.pageSize) {
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
        label="Search add-ons"
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
          onValueChange={(view) => onQueryChange({ ...query, view: view as AddonView })}
        >
          <TabsList>
            <TabsTrigger value={AddonView.Table} aria-label="Table view">
              <TableIcon aria-hidden />
            </TabsTrigger>
            <TabsTrigger value={AddonView.Cards} aria-label="Card view">
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
            title="No add-ons match these filters"
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
        {...(onAddonClick ? { onRowClick: onAddonClick } : {})}
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
        {/* Bounded scroll region so the pagination footer stays pinned in view —
            the same pattern the feature and plan grids use. */}
        {query.view === AddonView.Cards ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AddonCards
              addons={addons}
              isLoading={isLoading}
              onAddonClick={onAddonClick}
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
          noun="add-ons"
        />
      </DataGrid>
    </div>
  )
}

interface AddonCardsProps {
  addons: Addon[]
  isLoading: boolean
  onAddonClick?: ((addon: Addon) => void) | undefined
  onClearFilters?: (() => void) | undefined
  locale?: string | undefined
}

function AddonCards({ addons, isLoading, onAddonClick, onClearFilters, locale }: AddonCardsProps) {
  if (isLoading && addons.length === 0) {
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

  if (addons.length === 0) {
    return (
      <EmptyState
        size="inline"
        isFiltered
        title="No add-ons match these filters"
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
      {addons.map((addon) => {
        const clickable = Boolean(onAddonClick)
        return (
          <Card
            key={addon.id}
            size="sm"
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onAddonClick?.(addon) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onAddonClick?.(addon)
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
                  <CardTitle className="truncate">{addon.name}</CardTitle>
                  {addon.lookupKey ? (
                    <CardDescription className="truncate font-mono text-xs">
                      {addon.lookupKey}
                    </CardDescription>
                  ) : null}
                </div>
                <CatalogStatusBadge status={addon.status} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {addon.description ? (
                <AddonDetail label="Description">
                  <span className="line-clamp-2">{addon.description}</span>
                </AddonDetail>
              ) : null}
              <AddonDetail label="Created">{formatDate(addon.createdAt, locale)}</AddonDetail>
              <AddonDetail label="Updated">{formatDate(addon.updatedAt, locale)}</AddonDetail>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function AddonDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
