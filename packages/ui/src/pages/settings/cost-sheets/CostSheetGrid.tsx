import { useMemo } from 'react'
import {
  BookOpenIcon,
  CopyIcon,
  PencilIcon,
  ScrollTextIcon,
  SheetIcon,
  Trash2Icon,
  TrendingUpIcon,
  PlusIcon,
} from '@ui/icons'
import {
  COST_SHEET_SORT_LABEL,
  COST_SHEET_STATUS_LABEL,
  type CostSheet,
  type CostSheetQuery,
  CostSheetSortField,
  CostSheetStatus,
  DEFAULT_COST_SHEET_QUERY,
  COST_SHEET_FILTERS,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  type EntityColumn,
  dateColumn,
  idColumn,
  numberColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'

/**
 * The cost sheet list, over the shared `EntityList`.
 *
 * **Two of the redesign's columns are not here, and the redesign's own gap
 * list says why:** `Provider` and `Margin target` have no field on the API's
 * cost sheet. Margin target is the tempting one — it could be computed from a
 * sheet's prices against a plan's — but `money.ts` forbids money arithmetic in
 * the browser, and `priceCount` has already collapsed the prices to a count,
 * so there is nothing here to compute from even if it were allowed. Both are
 * omitted rather than dashed on every row.
 *
 * **The "Draft" tab is not here either.** `CostSheetStatus` is
 * `published | archived`; there is no draft state for the server to filter or
 * count. A third option that always shows nothing is worse than two that work.
 *
 * **No counts beside the status options.** `useCatalogStats` covers plans,
 * features, add-ons, coupons and price units — not cost sheets — and the only
 * other number available is how many of the twenty-five rows on screen match,
 * which is not the same question. So the options carry no number, which the
 * shared table supports by design.
 */
export const CostSheetGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Cost sheet columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(CostSheetSortField).map((value) => ({
  value,
  label: COST_SHEET_SORT_LABEL[value],
}))

/**
 * Every URL requested and returned 200.
 *
 * There is no narrative docs page for cost sheets: the concept lives in the
 * AI cost-tracking guides (which is where margin is explained) and in the
 * `/costs` API reference. Each card is titled by what its page actually
 * covers rather than by the entity — a card promising "what a cost sheet is"
 * that lands on a page never using the phrase is a dead link that happens to
 * return 200.
 */
const GUIDES: EntityGuide[] = [
  {
    title: 'Cost against revenue',
    description: 'How measuring what usage costs you turns into a margin you can watch.',
    href: 'https://docs.flexprice.io/docs/ai-cost-tracking/overview',
    icon: <TrendingUpIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Recording usage costs',
    description: 'Getting the per-unit costs in, so there is something to compare against.',
    href: 'https://docs.flexprice.io/docs/ai-cost-tracking/ingesting-ai-usage',
    icon: <ScrollTextIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Cost sheets in the API',
    description: 'The create endpoint, and the shape of a sheet and its prices.',
    href: 'https://docs.flexprice.io/api-reference/costs/create-costsheet',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
]

export interface CostSheetGridProps {
  costSheets: CostSheet[]
  total: number
  query: CostSheetQuery
  onQueryChange: (query: CostSheetQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onCostSheetClick?: (costSheet: CostSheet) => void
  /** The primary create action; renders a "New cost sheet" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: open the cost sheet's editor. Left out of the menu when absent. */
  onEdit?: ((costSheet: CostSheet) => void) | undefined
  /** Row menu: delete. The page confirms before it runs. */
  onDelete?: ((costSheet: CostSheet) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

export function CostSheetGrid({
  costSheets,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onCostSheetClick,
  onCreate,
  onEdit,
  onDelete,
  onClearFilters,
  locale,
}: CostSheetGridProps) {
  const columns = useMemo<EntityColumn<CostSheet>[]>(
    () => [
      textColumn<CostSheet>('name', 'Cost sheet', (row) => row.name, {
        width: 240,
        sortable: true,
        sortValue: CostSheetSortField.Name,
        hideable: false,
      }),
      idColumn<CostSheet>('lookupKey', 'Key', (row) => row.lookupKey, { width: 170 }),
      textColumn<CostSheet>('description', 'Description', (row) => row.description, {
        width: 280,
        muted: true,
      }),
      numberColumn<CostSheet>('priceCount', 'Line items', (row) => row.priceCount, {
        width: 120,
        ...(locale ? { locale } : {}),
      }),
      pillColumn<CostSheet>(
        'status',
        'Status',
        (row) => ({
          label: COST_SHEET_STATUS_LABEL[row.status],
          tone: row.status === CostSheetStatus.Published ? 'success' : 'neutral',
        }),
        { width: 130 },
      ),
      dateColumn<CostSheet>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: CostSheetSortField.UpdatedAt,
        ...(locale ? { locale } : {}),
      }),
      // Real, and on the old grid, but not in the redesign's default layout.
      dateColumn<CostSheet>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: CostSheetSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_COST_SHEET_QUERY.sortBy &&
    query.sortDirection === DEFAULT_COST_SHEET_QUERY.sortDirection

  const rowActions = (costSheet: CostSheet): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onCostSheetClick) {
      actions.push({
        label: 'View cost sheet',
        readOnly: true,
        icon: <SheetIcon aria-hidden className="size-4" />,
        onSelect: () => onCostSheetClick(costSheet),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Edit cost sheet',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(costSheet),
      })
    }
    actions.push({
      label: 'Copy cost sheet ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(costSheet.id),
    })
    if (onDelete) {
      actions.push({
        label: 'Delete cost sheet',
        icon: <Trash2Icon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onDelete(costSheet),
      })
    }
    return actions
  }

  return (
    <EntityList<CostSheet>
      label="Cost sheets"
      noun="cost sheets"
      rows={costSheets}
      total={total}
      columns={columns}
      getRowId={(costSheet) => costSheet.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search cost sheets…"
      filter={granularFilter({
        specs: COST_SHEET_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({ ...query, sortBy: sortBy as CostSheetSortField, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      exportFileName="cost-sheets"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden />
            New cost sheet
          </Button>
        ) : undefined
      }
      {...(onCostSheetClick ? { onRowClick: onCostSheetClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={
        query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
      }
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No cost sheets match these filters"
      empty={{
        scene: 'settings',
        title: 'No cost sheets yet',
        description:
          'A cost sheet records what each unit of usage costs you, so margin can be measured against what you charge for it.',
        guides: GUIDES,
      }}
    />
  )
}
