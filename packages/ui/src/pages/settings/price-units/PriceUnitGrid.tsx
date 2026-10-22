import { useMemo } from 'react'
import {
  BookOpenIcon,
  CoinsIcon,
  CopyIcon,
  PencilIcon,
  ScaleIcon,
  PlusIcon,
  ArchiveIcon,
} from '@ui/icons'
import {
  DEFAULT_PRICE_UNIT_QUERY,
  PRICE_UNIT_SORT_LABEL,
  PRICE_UNIT_STATUS_LABEL,
  type PriceUnit,
  type PriceUnitQuery,
  PriceUnitSortField,
  PriceUnitStatus,
  PRICE_UNIT_FILTERS,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import { type EntityColumn, dateColumn, idColumn, pillColumn, textColumn } from '../../shared/cells'

/**
 * The price unit list, over the shared `EntityList`.
 *
 * The only one of the six whose redesigned columns are all available *and*
 * complete — name, code, symbol, conversion and status, nothing dashed and
 * nothing added.
 *
 * Status is the advanced filter rather than a dropdown: a tenant has a
 * handful of price units, and the Status column already says what each one
 * is. A deep link carrying `?status=archived` is the same list the filter
 * rebuilds.
 */
export const PriceUnitGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Price unit columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(PriceUnitSortField).map((value) => ({
  value,
  label: PRICE_UNIT_SORT_LABEL[value],
}))

/**
 * The rate, spelled out as an equation — `1 CRD = 0.01 USD`.
 *
 * `conversionRate` is printed exactly as the API sent it. It arrives as a
 * string precisely so no precision is lost crossing the boundary, and parsing
 * it to a number to reformat it would throw that away for nothing.
 */
function conversionLabel(unit: PriceUnit): string | null {
  if (!unit.code || !unit.conversionRate || !unit.baseCurrency) return null
  return `1 ${unit.code} = ${unit.conversionRate} ${unit.baseCurrency.toUpperCase()}`
}

/** Every URL requested and returned 200; all three are in the docs sitemap. */
const GUIDES: EntityGuide[] = [
  {
    title: 'What a pricing unit is',
    description: 'Charging in credits or tokens instead of a currency.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/custom-pricing/pricing-unit',
    icon: <CoinsIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Custom currencies',
    description: 'Pinning a code and a symbol to a base currency through a rate.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/custom-pricing/custom-currency',
    icon: <ScaleIcon aria-hidden className="size-4" />,
  },
  {
    title: 'When to use one',
    description: 'The pricing shapes custom units make possible, with worked examples.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/custom-pricing/use-cases',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
]

export interface PriceUnitGridProps {
  priceUnits: PriceUnit[]
  total: number
  query: PriceUnitQuery
  onQueryChange: (query: PriceUnitQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onPriceUnitClick?: (priceUnit: PriceUnit) => void
  /** The primary create action; renders a "New price unit" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: open the editor. Only the name is editable once created. */
  onEdit?: ((priceUnit: PriceUnit) => void) | undefined
  /** Row menu: archive. Rendered destructive, last. */
  onArchive?: ((priceUnit: PriceUnit) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

export function PriceUnitGrid({
  priceUnits,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onPriceUnitClick,
  onCreate,
  onEdit,
  onArchive,
  onClearFilters,
  locale,
}: PriceUnitGridProps) {
  const columns = useMemo<EntityColumn<PriceUnit>[]>(
    () => [
      textColumn<PriceUnit>('name', 'Name', (row) => row.name, {
        width: 220,
        sortable: true,
        sortValue: PriceUnitSortField.Name,
        hideable: false,
      }),
      idColumn<PriceUnit>('code', 'Code', (row) => row.code, {
        width: 110,
        sortable: true,
        sortValue: PriceUnitSortField.Code,
      }),
      textColumn<PriceUnit>('symbol', 'Symbol', (row) => row.symbol, { width: 100 }),
      textColumn<PriceUnit>('conversion', 'Conversion', conversionLabel, { width: 200 }),
      pillColumn<PriceUnit>(
        'status',
        'Status',
        (row) => ({
          label: PRICE_UNIT_STATUS_LABEL[row.status],
          tone: row.status === PriceUnitStatus.Published ? 'success' : 'neutral',
        }),
        { width: 130 },
      ),
      // Real, and on the old grid, but not among the five the redesign names.
      // One click away in the `⋯` menu rather than dropped.
      dateColumn<PriceUnit>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: PriceUnitSortField.UpdatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
      dateColumn<PriceUnit>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: PriceUnitSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_PRICE_UNIT_QUERY.sortBy &&
    query.sortDirection === DEFAULT_PRICE_UNIT_QUERY.sortDirection

  const rowActions = (priceUnit: PriceUnit): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onPriceUnitClick) {
      actions.push({
        label: 'View price unit',
        readOnly: true,
        icon: <CoinsIcon aria-hidden className="size-4" />,
        onSelect: () => onPriceUnitClick(priceUnit),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Rename price unit',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(priceUnit),
      })
    }
    actions.push({
      label: 'Copy price unit ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(priceUnit.id),
    })
    if (onArchive && priceUnit.status !== PriceUnitStatus.Archived) {
      actions.push({
        label: 'Archive price unit',
        icon: <ArchiveIcon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onArchive(priceUnit),
      })
    }
    return actions
  }

  return (
    <EntityList<PriceUnit>
      label="Price units"
      noun="price units"
      rows={priceUnits}
      total={total}
      columns={columns}
      getRowId={(priceUnit) => priceUnit.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search price units…"
      filter={granularFilter({
        specs: PRICE_UNIT_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({ ...query, sortBy: sortBy as PriceUnitSortField, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      exportFileName="price-units"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden />
            New price unit
          </Button>
        ) : undefined
      }
      {...(onPriceUnitClick ? { onRowClick: onPriceUnitClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={
        query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
      }
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No price units match these filters"
      empty={{
        scene: 'settings',
        title: 'No price units yet',
        description:
          'A price unit lets you charge in something other than a currency — credits, tokens, minutes — by pinning a code and a symbol to a base currency through a rate.',
        guides: GUIDES,
      }}
    />
  )
}
