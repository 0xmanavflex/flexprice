import { useMemo } from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  AGGREGATION_LABEL,
  FEATURE_TYPE_LABEL,
  type Feature,
  type FeatureQuery,
  FeatureType,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { DataGrid, dataGridFeatures } from '@ui/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@ui/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@ui/components/reui/data-grid/data-grid-pagination'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import { Button } from '@ui/primitives/button'
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

export interface FeatureGridProps {
  features: Feature[]
  total: number
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onFeatureClick?: (feature: Feature) => void
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
    <DataGrid
      table={table as never}
      recordCount={total}
      isLoading={isLoading}
      emptyMessage="No features match these filters."
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
      <DataGridPagination />
    </DataGrid>
  )
}
