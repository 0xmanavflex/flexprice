import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  GROUP_ENTITY_TYPE_LABEL,
  GROUP_SORT_LABEL,
  type Group,
  type GroupQuery,
  GroupSortField,
  GroupView,
} from '@fp/domain'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@ui/components/reui/data-grid/data-grid-scroll-area'
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
import { CatalogStatusBadge } from './StatusBadge'

/**
 * The group list.
 *
 * The same controlled table/cards shape as `CouponGrid`, with a group's own
 * columns: what it holds (prices or features), how many members it has, and its
 * status. Filtering is passed in through the `filters` slot.
 */
export const GroupGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', 'ui/card', 'ui/tabs'],
  note: 'Controlled wrapper; the page owns query state. Table and cards over one query.',
})

const SORT_OPTIONS = Object.values(GroupSortField).map((value) => ({
  value,
  label: GROUP_SORT_LABEL[value],
}))

export interface GroupGridProps {
  groups: Group[]
  total: number
  query: GroupQuery
  onQueryChange: (query: GroupQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onGroupClick?: (group: Group) => void
  filters?: ReactNode
  onClearFilters?: () => void
  locale?: string
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

/** "12 prices", "1 feature" — the count with the kind it holds. */
function membersLabel(group: Group, locale?: string): string {
  const count = new Intl.NumberFormat(locale).format(group.entityCount)
  const noun = GROUP_ENTITY_TYPE_LABEL[group.entityType].toLowerCase()
  const singular = group.entityCount === 1 ? noun.replace(/s$/, '') : noun
  return `${count} ${singular}`
}

export function GroupGrid({
  groups,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onGroupClick,
  filters,
  onClearFilters,
  locale,
}: GroupGridProps) {
  const columns = useMemo<ColumnDef<never, Group>[]>(
    () =>
      [
        {
          id: 'name',
          meta: { skeleton: <Skeleton className="h-4 w-40" /> },
          accessorFn: (row: Group) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Group" column={column} />,
          cell: ({ row }: { row: { original: Group } }) => (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.name}</span>
              {row.original.lookupKey ? (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {row.original.lookupKey}
                </span>
              ) : null}
            </div>
          ),
          enableSorting: false,
          size: 260,
        },
        {
          id: 'entityType',
          meta: { skeleton: <Skeleton className="h-4 w-16" /> },
          accessorFn: (row: Group) => row.entityType,
          header: ({ column }: never) => <DataGridColumnHeader title="Holds" column={column} />,
          cell: ({ row }: { row: { original: Group } }) => (
            <span className="text-muted-foreground">
              {GROUP_ENTITY_TYPE_LABEL[row.original.entityType]}
            </span>
          ),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'members',
          meta: { skeleton: <Skeleton className="h-4 w-16" /> },
          accessorFn: (row: Group) => row.entityCount,
          header: ({ column }: never) => <DataGridColumnHeader title="Members" column={column} />,
          cell: ({ row }: { row: { original: Group } }) => (
            <span className="tabular-nums text-muted-foreground">
              {membersLabel(row.original, locale)}
            </span>
          ),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'status',
          meta: { skeleton: <Skeleton className="h-4 w-16 rounded-full" /> },
          accessorFn: (row: Group) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Group } }) => (
            <CatalogStatusBadge status={row.original.status} />
          ),
          enableSorting: false,
          size: 120,
        },
        {
          id: 'updatedAt',
          meta: { skeleton: <Skeleton className="h-4 w-24" /> },
          accessorFn: (row: Group) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Group } }) => formatDate(row.original.updatedAt, locale),
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
    data: groups,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Group) => row.id,
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
    enabled: fitToWindow && query.view === GroupView.Table,
    reservedHeight: 104,
  })

  if (fitToWindow && query.view === GroupView.Table && capacity !== null && capacity !== query.pageSize) {
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
        label="Search groups"
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
          onValueChange={(view) => onQueryChange({ ...query, view: view as GroupView })}
        >
          <TabsList>
            <TabsTrigger value={GroupView.Table} aria-label="Table view">
              <TableIcon aria-hidden />
            </TabsTrigger>
            <TabsTrigger value={GroupView.Cards} aria-label="Card view">
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
            title="No groups match these filters"
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
        {...(onGroupClick ? { onRowClick: onGroupClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          width: 'auto',
          rowBorder: false,
          dense: true,
        }}
      >
        {query.view === GroupView.Cards ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GroupCards
              groups={groups}
              isLoading={isLoading}
              onGroupClick={onGroupClick}
              onClearFilters={onClearFilters}
              locale={locale}
            />
          </div>
        ) : (
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
          noun="groups"
        />
      </DataGrid>
    </div>
  )
}

interface GroupCardsProps {
  groups: Group[]
  isLoading: boolean
  onGroupClick?: ((group: Group) => void) | undefined
  onClearFilters?: (() => void) | undefined
  locale?: string | undefined
}

function GroupCards({ groups, isLoading, onGroupClick, onClearFilters, locale }: GroupCardsProps) {
  if (isLoading && groups.length === 0) {
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

  if (groups.length === 0) {
    return (
      <EmptyState
        size="inline"
        isFiltered
        title="No groups match these filters"
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
      {groups.map((group) => {
        const clickable = Boolean(onGroupClick)
        return (
          <Card
            key={group.id}
            size="sm"
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onGroupClick?.(group) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onGroupClick?.(group)
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
                  <CardTitle className="truncate">{group.name}</CardTitle>
                  {group.lookupKey ? (
                    <CardDescription className="truncate font-mono text-xs">
                      {group.lookupKey}
                    </CardDescription>
                  ) : null}
                </div>
                <CatalogStatusBadge status={group.status} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <GroupDetail label="Holds">{GROUP_ENTITY_TYPE_LABEL[group.entityType]}</GroupDetail>
              <GroupDetail label="Members">
                <span className="tabular-nums">{membersLabel(group, locale)}</span>
              </GroupDetail>
              <GroupDetail label="Updated">{formatDate(group.updatedAt, locale)}</GroupDetail>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function GroupDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
