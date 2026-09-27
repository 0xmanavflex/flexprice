import { useMemo, useRef, useState, type ReactNode } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  PLAN_SORT_LABEL,
  PLAN_STATUS_LABEL,
  type Plan,
  type PlanQuery,
  PlanSortField,
  PlanStatus,
  PlanView,
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
 * The plan list.
 *
 * The same controlled shape as `FeatureGrid` — the route owns the query, this
 * renders it and reports intent — with two layouts over one query: a dense
 * table for scanning, a cards grid for reading. Filtering is passed in through
 * the `filters` slot, so this component never learns what a plan status is.
 */
export const PlanGridProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/badge', 'ui/card', 'ui/tabs'],
  note: 'Controlled wrapper; the page owns query state. Table and cards over one query.',
})

const SORT_OPTIONS = Object.values(PlanSortField).map((value) => ({
  value,
  label: PLAN_SORT_LABEL[value],
}))

export interface PlanGridProps {
  plans: Plan[]
  total: number
  query: PlanQuery
  onQueryChange: (query: PlanQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onPlanClick?: (plan: Plan) => void
  /** Filter controls, rendered beside Sort. */
  filters?: ReactNode
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

const STATUS_VARIANT: Record<PlanStatus, 'success-light' | 'secondary'> = {
  [PlanStatus.Published]: 'success-light',
  [PlanStatus.Archived]: 'secondary',
}

function formatDate(value: Date | null, locale?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
}

/** "2 charges", "1 charge", or the muted note that a plan bills nothing yet. */
function charges(count: number): ReactNode {
  if (count === 0) return <span className="text-muted-foreground">No charges</span>
  return `${count} charge${count === 1 ? '' : 's'}`
}

export function PlanGrid({
  plans,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPlanClick,
  filters,
  onClearFilters,
  locale,
}: PlanGridProps) {
  const columns = useMemo<ColumnDef<never, Plan>[]>(
    () =>
      [
        {
          id: 'name',
          accessorFn: (row: Plan) => row.name,
          header: ({ column }: never) => <DataGridColumnHeader title="Plan" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => (
            <div className="flex flex-col">
              <span className="font-medium">{row.original.name}</span>
              {row.original.lookupKey ? (
                <span className="text-xs text-muted-foreground">{row.original.lookupKey}</span>
              ) : null}
            </div>
          ),
          enableSorting: false,
          size: 260,
        },
        {
          id: 'status',
          accessorFn: (row: Plan) => row.status,
          header: ({ column }: never) => <DataGridColumnHeader title="Status" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => (
            <Badge variant={STATUS_VARIANT[row.original.status]} size="sm">
              {PLAN_STATUS_LABEL[row.original.status]}
            </Badge>
          ),
          enableSorting: false,
          size: 120,
        },
        {
          id: 'charges',
          accessorFn: (row: Plan) => row.chargeCount,
          header: ({ column }: never) => <DataGridColumnHeader title="Charges" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => charges(row.original.chargeCount),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'createdAt',
          accessorFn: (row: Plan) => row.createdAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Created" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => formatDate(row.original.createdAt, locale),
          enableSorting: false,
          size: 140,
        },
        {
          id: 'updatedAt',
          accessorFn: (row: Plan) => row.updatedAt,
          header: ({ column }: never) => <DataGridColumnHeader title="Updated" column={column} />,
          cell: ({ row }: { row: { original: Plan } }) => formatDate(row.original.updatedAt, locale),
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
    data: plans,
    columns,
    manualPagination: true,
    rowCount: total,
    getRowId: (row: Plan) => row.id,
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
    enabled: fitToWindow && query.view === PlanView.Table,
    reservedHeight: 104,
  })

  if (fitToWindow && query.view === PlanView.Table && capacity !== null && capacity !== query.pageSize) {
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
        label="Search plans"
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
          onValueChange={(view) => onQueryChange({ ...query, view: view as PlanView })}
        >
          <TabsList>
            <TabsTrigger value={PlanView.Table} aria-label="Table view">
              <TableIcon aria-hidden />
            </TabsTrigger>
            <TabsTrigger value={PlanView.Cards} aria-label="Card view">
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
            title="No plans match these filters"
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
        {...(onPlanClick ? { onRowClick: onPlanClick } : {})}
        tableLayout={{
          headerSticky: true,
          columnsVisibility: true,
          width: 'fixed',
          rowBorder: false,
          dense: true,
        }}
      >
        {query.view === PlanView.Cards ? (
          <PlanCards
            plans={plans}
            isLoading={isLoading}
            onPlanClick={onPlanClick}
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
          noun="plans"
        />
      </DataGrid>
    </div>
  )
}

interface PlanCardsProps {
  plans: Plan[]
  isLoading: boolean
  onPlanClick?: ((plan: Plan) => void) | undefined
  onClearFilters?: (() => void) | undefined
  locale?: string | undefined
}

/** The same rows as the table, one card each — the layout for reading a plan. */
function PlanCards({ plans, isLoading, onPlanClick, onClearFilters, locale }: PlanCardsProps) {
  if (isLoading && plans.length === 0) {
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

  if (plans.length === 0) {
    return (
      <EmptyState
        size="inline"
        isFiltered
        title="No plans match these filters"
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
      {plans.map((plan) => {
        const clickable = Boolean(onPlanClick)
        return (
          <Card
            key={plan.id}
            size="sm"
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onPlanClick?.(plan) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onPlanClick?.(plan)
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
                  <CardTitle className="truncate">{plan.name}</CardTitle>
                  {plan.lookupKey ? (
                    <CardDescription className="truncate font-mono text-xs">
                      {plan.lookupKey}
                    </CardDescription>
                  ) : null}
                </div>
                <Badge variant={STATUS_VARIANT[plan.status]} size="sm">
                  {PLAN_STATUS_LABEL[plan.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <PlanDetail label="Charges">{charges(plan.chargeCount)}</PlanDetail>
              {plan.description ? (
                <PlanDetail label="Description">
                  <span className="line-clamp-2">{plan.description}</span>
                </PlanDetail>
              ) : null}
              <PlanDetail label="Created">{formatDate(plan.createdAt, locale)}</PlanDetail>
              <PlanDetail label="Updated">{formatDate(plan.updatedAt, locale)}</PlanDetail>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function PlanDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  )
}
