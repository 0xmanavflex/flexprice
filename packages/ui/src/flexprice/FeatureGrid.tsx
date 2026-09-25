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
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { Button } from '@ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu'
import { ChevronDownIcon, FilterIcon } from 'lucide-react'
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
 */
export const FeatureGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge'],
  note: 'Controlled wrapper; the page owns query state.',
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
          id: 'createdAt',
          accessorFn: (row: Feature) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Feature } }) =>
            row.original.createdAt
              ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                  row.original.createdAt,
                )
              : '—',
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
    enabled: fitToWindow,
    // The toolbar above and the footer below are not rows.
    reservedHeight: 104,
  })

  // `null` means no measurement yet — keep whatever size is already set.
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
        placeholder="Search..."
        label="Search features"
      >
        {/*
          Type is the only filter features have, so it is the Filter button
          rather than hiding behind one. Checkboxes, not radios: "metered or
          boolean" is a question people actually ask.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={
                  query.types.length > 0
                    ? `Filter features, ${query.types.length} selected`
                    : 'Filter features'
                }
              />
            }
          >
            <FilterIcon aria-hidden className="size-4" />
            Filters
            {query.types.length > 0 ? (
              <Badge variant="outline" size="sm" radius="full">
                {query.types.length}
              </Badge>
            ) : null}
            <ChevronDownIcon data-icon="inline-end" aria-hidden />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="min-w-52 rounded-2xl p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-normal text-muted-foreground">
                Type
              </DropdownMenuLabel>
              {Object.values(FeatureType).map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  className="gap-2 rounded-xl px-2.5 py-2"
                  checked={query.types.includes(type)}
                  onCheckedChange={(checked) =>
                    onQueryChange({
                      ...query,
                      types: checked
                        ? [...query.types, type]
                        : query.types.filter((t) => t !== type),
                      page: 1,
                    })
                  }
                >
                  {FEATURE_TYPE_LABEL[type]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

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
        <DataGridTable />
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
