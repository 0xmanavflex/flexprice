import { useMemo } from 'react'
import { CopyIcon, LinkIcon, ListIcon, PencilIcon, PercentIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import {
  DEFAULT_TAX_RATE_QUERY,
  TAX_RATE_SCOPE_LABEL,
  TAX_RATE_SORT_LABEL,
  TAX_RATE_STATUS_LABEL,
  type TaxRate,
  type TaxRateQuery,
  TaxRateSortField,
  TaxRateStatus,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from './EntityList'
import { type EntityColumn, idColumn, pillColumn, textColumn } from './cells'

/**
 * The tax rate list, on the shared `EntityList`.
 *
 * ## "Applied to" is not here
 *
 * The redesign asks for a count of what each rate is attached to. The
 * capability exists — `GET /taxes/associations`
 * (`client.taxAssociations.listTaxAssociations`) takes a `tax_rate_id` and
 * returns a paginated list whose `pagination.total` is exactly that number —
 * but nothing in this repo calls it, and wiring it is a data-layer change
 * rather than a column: one request per rate on screen, or one unfiltered
 * fetch grouped by `tax_rate_id` which is only honest while the whole set
 * fits in a page.
 *
 * So it is omitted rather than shipped as a column of em dashes or, worse, a
 * column of zeros — "this rate applies to nothing" and "we did not ask" look
 * identical in a table and only one of them is true. It is the cheapest of
 * the gaps on these five grids to close, and the only one where the endpoint
 * is already sitting in the SDK.
 */
export const TaxRateGridProvenance = provenance({
  source: 'composition',
  composes: ['flexprice/EntityList'],
  note: 'Tax rate columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(TaxRateSortField).map((value) => ({
  value,
  label: TAX_RATE_SORT_LABEL[value],
}))

const STATUS_ALL = 'all'

/** Every URL requested and confirmed 200. The `api-reference/tax-rates/…`
 *  namespace a first draft guessed at 404s; associations is the real one. */
const GUIDES: EntityGuide[] = [
  {
    title: 'Applying a rate',
    description: 'Attaching a tax rate to a customer, a plan or a single charge.',
    href: 'https://docs.flexprice.io/api-reference/tax-associations/create-tax-association',
    icon: <LinkIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Seeing where one applies',
    description: 'Listing everything a rate is currently attached to.',
    href: 'https://docs.flexprice.io/api-reference/tax-associations/list-tax-associations',
    icon: <ListIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Changing an association',
    description: 'Moving a rate, or ending one without deleting the rate itself.',
    href: 'https://docs.flexprice.io/api-reference/tax-associations/update-tax-association',
    icon: <PercentIcon aria-hidden className="size-4" />,
  },
]

export interface TaxRateGridProps {
  taxRates: TaxRate[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: TaxRateQuery
  onQueryChange: (query: TaxRateQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  onTaxRateClick?: (taxRate: TaxRate) => void
  /** The primary create action; renders a "New tax rate" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: open the tax rate's editor. Left out of the menu when absent. */
  onEdit?: ((taxRate: TaxRate) => void) | undefined
  /** Row menu: delete. The page confirms before it runs. */
  onDelete?: ((taxRate: TaxRate) => void) | undefined
  /** Inline rename from the name cell. Absent leaves the name read-only. */
  onRename?: ((taxRate: TaxRate, name: string) => void | Promise<void>) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
}

export function TaxRateGrid({
  taxRates,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onTaxRateClick,
  onCreate,
  onEdit,
  onDelete,
  onRename,
  onClearFilters,
}: TaxRateGridProps) {
  const columns = useMemo<EntityColumn<TaxRate>[]>(
    () => [
      textColumn<TaxRate>('name', 'Tax rate', (row) => row.name, {
        width: 240,
        sortable: true,
        sortValue: TaxRateSortField.Name,
        hideable: false,
        ...(onRename ? { onEdit: onRename } : {}),
      }),
      idColumn<TaxRate>('code', 'Code', (row) => row.code, { width: 160 }),
      /*
       * The percentage exactly as the API sends it, with a sign appended.
       *
       * Not `numberColumn`: that would parse `"18"` into a float to format
       * it, and the one thing this codebase is consistent about is that a
       * decimal the API sent never becomes a `number`. `"18"` and `"18.5"`
       * both render as themselves; `tabular-nums` keeps the column aligned
       * without the round trip.
       */
      textColumn<TaxRate>(
        'rate',
        'Rate %',
        (row) => (row.percentageValue ? `${row.percentageValue}%` : null),
        { width: 110 },
      ),
      pillColumn<TaxRate>('scope', 'Scope', (row) => ({
        label: TAX_RATE_SCOPE_LABEL[row.scope],
      })),
      pillColumn<TaxRate>('status', 'Status', (row) => ({
        label: TAX_RATE_STATUS_LABEL[row.status],
        tone: row.status === TaxRateStatus.Published ? 'success' : 'neutral',
      })),
    ],
    [onRename],
  )

  const statusValue = query.statuses.length === 1 ? (query.statuses[0] ?? STATUS_ALL) : STATUS_ALL

  const isDefaultSort =
    query.sortBy === DEFAULT_TAX_RATE_QUERY.sortBy &&
    query.sortDirection === DEFAULT_TAX_RATE_QUERY.sortDirection

  const rowActions = (taxRate: TaxRate): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onTaxRateClick) {
      actions.push({
        label: 'View tax rate',
        icon: <PercentIcon aria-hidden className="size-4" />,
        onSelect: () => onTaxRateClick(taxRate),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Edit tax rate',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(taxRate),
      })
    }
    actions.push({
      label: 'Copy tax rate ID',
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(taxRate.id),
    })
    if (onDelete) {
      actions.push({
        label: 'Delete tax rate',
        icon: <Trash2Icon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onDelete(taxRate),
      })
    }
    return actions
  }

  return (
    <EntityList<TaxRate>
      label="Tax rates"
      noun="tax rates"
      rows={taxRates}
      total={total}
      columns={columns}
      getRowId={(taxRate) => taxRate.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search tax rates…"
      /*
       * No counts: `GET /taxes/rates` exposes paging and an order direction
       * and nothing else, so `fetchTaxRates` narrows status on the page it
       * received. There is no per-status server total to read.
       */
      status={{
        value: statusValue,
        label: 'Status',
        onChange: (value) =>
          onQueryChange({
            ...query,
            statuses: value === STATUS_ALL ? [] : [value as TaxRateStatus],
            page: 1,
          }),
        options: [
          { value: STATUS_ALL, label: 'All' },
          ...Object.values(TaxRateStatus).map((value) => ({
            value,
            label: TAX_RATE_STATUS_LABEL[value],
          })),
        ],
      }}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({
            ...query,
            sortBy: sortBy as TaxRateSortField,
            sortDirection,
            page: 1,
          }),
      }}
      selectable
      rowActions={rowActions}
      exportFileName="tax-rates"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden className="size-4" />
            New tax rate
          </Button>
        ) : undefined
      }
      {...(onTaxRateClick ? { onRowClick: onTaxRateClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No tax rates match these filters"
      empty={{
        title: 'No tax rates yet',
        description:
          'A tax rate is a percentage the billing engine adds to an invoice. Create one, then attach it to the customers, plans or charges it applies to.',
        ...(onCreate ? { actions: <Button onClick={onCreate}>New tax rate</Button> } : {}),
        guides: GUIDES,
      }}
    />
  )
}
