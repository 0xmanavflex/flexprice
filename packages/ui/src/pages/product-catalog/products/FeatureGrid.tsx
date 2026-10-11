import { useMemo } from 'react'
import {
  BookOpenIcon,
  CopyIcon,
  CopyPlusIcon,
  GaugeIcon,
  PencilIcon,
  PlusIcon,
  ScrollTextIcon,
  SquareStackIcon,
  Trash2Icon,
} from '@ui/icons'
import {
  aggregationFormula,
  DEFAULT_FEATURE_QUERY,
  FEATURE_SORT_LABEL,
  FEATURE_TYPE_LABEL,
  type Feature,
  type FeatureQuery,
  FeatureSortField,
  FeatureType,
} from '@fp/domain'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterNode } from '@ui/components/reui/filters/filters-types'
import type { FlatFilter } from '@ui/compositions/tables/FilterBar'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  EmDash,
  EntityCell,
  FeatureTypePill,
  Formula,
  Pill,
  type EntityColumn,
  idColumn,
  textColumn,
} from '../../shared/cells'

/**
 * The feature list — and the reference migration onto `EntityList`.
 *
 * There is almost nothing here now, which is the point. Everything this file
 * used to own — the `useTable` call, the `tableLayout`, the toolbar, the
 * footer, the empty body, the fit-to-window state — was the same code as the
 * eleven other grids, differing only in the ways nobody chose. What is left is
 * the part that is genuinely about features: which columns, what they are
 * called, what a row's menu offers, and how a feature query maps onto the
 * shared table's vocabulary.
 *
 * Use it as the template for the remaining eleven. The pattern is:
 *
 *   1. `columns` from the helpers in `cells.tsx` — never a hand-written cell.
 *   2. The domain query in, the shared table's flat callbacks out. The route
 *      still owns the query; this only translates.
 *   3. Anything the table cannot know — the status counts, what "filtered"
 *      means for this entity — comes in as a prop.
 *
 * Status is deliberately in the toolbar's dropdown and *not* in the filter
 * builder. Offering it in both gives two controls writing `query.statuses`,
 * and the first thing that happens is they disagree.
 */
export const FeatureGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Feature columns and actions over the shared list table. The reference migration.',
})

const SORT_OPTIONS = Object.values(FeatureSortField).map((value) => ({
  value,
  label: FEATURE_SORT_LABEL[value],
}))

const TYPE_OPTIONS = Object.values(FeatureType).map((value) => ({
  value,
  label: FEATURE_TYPE_LABEL[value],
}))

/**
 * What the filter builder offers.
 *
 * `is_any_of` only: it is the one operator whose flattened result maps onto
 * the query and survives a URL round trip, and offering operators the URL
 * cannot carry is offering a filter that vanishes when the page is shared.
 */
const FILTER_FIELDS: FilterField[] = [
  {
    id: 'type',
    label: 'Type',
    type: 'select',
    options: TYPE_OPTIONS,
    operators: [{ value: 'is_any_of', label: 'is any of', arity: 'many' }],
    defaultOperator: 'is_any_of',
  },
]

const TYPES = new Set<string>(Object.values(FeatureType))

/**
 * The three cards under the first-run empty state.
 *
 * Every URL here was requested and returned 200. That check is worth keeping
 * when these change: the first draft guessed `docs.flexprice.io/features`,
 * which 404s — the real site namespaces everything under `/docs/` (or
 * `/api-reference/`), and V1 has been linking the correct paths all along in
 * `flexprice-front/src/constants/guides.tsx`. A dead link in an empty state is
 * worse than no link, because the empty state is where someone has already
 * admitted they do not know what to do next.
 */
const GUIDES: EntityGuide[] = [
  {
    title: 'What a product is',
    description: 'Metered, boolean and static products, and when to reach for each.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/features/use-cases',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Sending usage events',
    description: 'How a metered product turns raw events into something billable.',
    href: 'https://docs.flexprice.io/api-reference/events/ingest-event',
    icon: <ScrollTextIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Pricing a product',
    description: 'Attach a product to a plan with a charge and an entitlement.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/features/linking-to-plans',
    icon: <SquareStackIcon aria-hidden className="size-4" />,
  },
]

/**
 * How a product is wired into the catalogue, as the grid shows it.
 *
 * Read from elsewhere (entitlements, plans, subscriptions) and handed in per
 * product id, so the grid stays a table and never becomes a data loader. A
 * product with no entry is still loading its linkage; `subscriptions` is
 * undefined when it could not be counted, which is not the same as zero.
 */
export interface ProductLinkage {
  plans: { id: string; name: string }[]
  entitlements: number
  subscriptions: number | undefined
}

/** Chips shown before the rest collapse into "+N". */
const VISIBLE_PLAN_CHIPS = 2

export interface FeatureGridProps {
  features: Feature[]
  /** Plans, entitlements and subscriptions per product id. */
  linkage?: ReadonlyMap<string, ProductLinkage>
  /** The linkage is still being read; its three columns show a placeholder. */
  linkageLoading?: boolean
  /** The "Add entitlement" action on a product no plan grants yet. */
  onCreateEntitlement?: (feature: Feature) => void
  total: number
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onFeatureClick?: (feature: Feature) => void
  /** The primary create action; renders a "New product" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row-menu Edit; opens the editor dialog. */
  onEdit?: ((feature: Feature) => void) | undefined
  /** Row-menu Clone. */
  onClone?: ((feature: Feature) => void) | undefined
  /** Row-menu Delete; the caller confirms. */
  onDelete?: ((feature: Feature) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

export function FeatureGrid({
  features,
  linkage,
  linkageLoading = false,
  onCreateEntitlement,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onFeatureClick,
  onCreate,
  onEdit,
  onClone,
  onDelete,
  onClearFilters,
}: FeatureGridProps) {
  /*
   * Widths are shares, not pixels: `EntityList` scales every column so the set
   * fills the page. They are kept close to one another on purpose, so a narrow
   * or wide screen spreads the room evenly instead of handing it all to one
   * column and leaving the others cramped.
   */
  const columns = useMemo<EntityColumn<Feature>[]>(
    () => [
      {
        ...textColumn<Feature>('name', 'Name', (row) => row.name, {
          width: 220,
          sortable: true,
          sortValue: FeatureSortField.Name,
          // The column the list is *for*. Hiding it leaves a table of
          // attributes belonging to nothing.
          hideable: false,
        }),
        cell: (row) => <EntityCell name={row.name} />,
      },
      {
        // The glyph depends on the row, so the cell is written here rather
        // than through `pillColumn`, which takes one spec per row.
        id: 'type',
        header: 'Type',
        width: 120,
        text: (row) => FEATURE_TYPE_LABEL[row.type],
        cell: (row) => <FeatureTypePill type={row.type} label={FEATURE_TYPE_LABEL[row.type]} />,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
      },
      idColumn<Feature>('eventName', 'Event name', (row) => row.eventName, { width: 170 }),
      {
        id: 'aggregation',
        header: 'Aggregation',
        width: 170,
        text: (row) => aggregationFormula(row) ?? '',
        cell: (row) => <Formula value={aggregationFormula(row)} />,
        skeleton: <Skeleton className="h-6 w-32 rounded-md" />,
      },
      {
        id: 'plans',
        header: 'Plans',
        width: 200,
        text: (row) => (linkage?.get(row.id)?.plans ?? []).map((plan) => plan.name).join(', '),
        cell: (row) => {
          const entry = linkage?.get(row.id)
          if (!entry)
            return linkageLoading ? <Skeleton className="h-6 w-24 rounded-full" /> : <EmDash />
          if (entry.plans.length === 0) return <EmDash />
          const shown = entry.plans.slice(0, VISIBLE_PLAN_CHIPS)
          const rest = entry.plans.length - shown.length
          return (
            <div className="flex min-w-0 items-center gap-1.5">
              {shown.map((plan) => (
                <Pill key={plan.id} className="max-w-36 min-w-0">
                  <span className="truncate">{plan.name}</span>
                </Pill>
              ))}
              {rest > 0 ? (
                <span
                  className="text-muted-foreground shrink-0 text-xs"
                  title={entry.plans
                    .slice(VISIBLE_PLAN_CHIPS)
                    .map((plan) => plan.name)
                    .join(', ')}
                >
                  +{rest}
                </span>
              ) : null}
            </div>
          )
        },
        skeleton: <Skeleton className="h-6 w-32 rounded-full" />,
      },
      {
        id: 'entitlements',
        header: 'Entitlements',
        width: 160,
        text: (row) => String(linkage?.get(row.id)?.entitlements ?? 0),
        cell: (row) => {
          const entry = linkage?.get(row.id)
          if (!entry)
            return linkageLoading ? <Skeleton className="h-6 w-20 rounded-full" /> : <EmDash />
          if (entry.entitlements > 0) {
            return (
              <Pill tone="success">
                {entry.entitlements} {entry.entitlements === 1 ? 'entitlement' : 'entitlements'}
              </Pill>
            )
          }
          if (!onCreateEntitlement) return <EmDash />
          // `xs` (24px, the pill's height) so the action sits on the row's
          // centre line like the pills around it instead of crowding the cell.
          return (
            <div className="flex min-w-0 items-center">
              <Button
                variant="outline"
                size="xs"
                className="max-w-full"
                onClick={(event) => {
                  event.stopPropagation()
                  onCreateEntitlement(row)
                }}
              >
                <PlusIcon aria-hidden />
                <span className="truncate">Add entitlement</span>
              </Button>
            </div>
          )
        },
        skeleton: <Skeleton className="h-6 w-24 rounded-full" />,
      },
      {
        id: 'subscriptions',
        header: 'Contracts',
        width: 120,
        text: (row) => String(linkage?.get(row.id)?.subscriptions ?? ''),
        cell: (row) => {
          const entry = linkage?.get(row.id)
          if (!entry) return linkageLoading ? <Skeleton className="h-4 w-8" /> : <EmDash />
          if (entry.subscriptions === undefined) return <EmDash />
          return <span className="tabular-nums">{entry.subscriptions.toLocaleString()}</span>
        },
        skeleton: <Skeleton className="h-4 w-8" />,
      },
    ],
    [linkage, linkageLoading, onCreateEntitlement],
  )

  /* --- the filter builder's tree, rebuilt from the query every render, so
         the chips and the URL cannot drift --- */
  const filterRules: FilterNode[] = []
  if (query.types.length > 0) {
    filterRules.push(
      createFilterRule({ id: 'type', path: ['type'], operator: 'is_any_of', value: query.types }),
    )
  }

  const isDefaultSort =
    query.sortBy === DEFAULT_FEATURE_QUERY.sortBy &&
    query.sortDirection === DEFAULT_FEATURE_QUERY.sortDirection

  const rowActions = (feature: Feature): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onFeatureClick) {
      actions.push({
        label: 'View product',
        icon: <GaugeIcon aria-hidden className="size-4" />,
        onSelect: () => onFeatureClick(feature),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Edit product',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(feature),
      })
    }
    if (onClone) {
      actions.push({
        label: 'Clone product',
        icon: <CopyPlusIcon aria-hidden className="size-4" />,
        onSelect: () => onClone(feature),
      })
    }
    actions.push({
      label: 'Copy product ID',
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(feature.id),
    })
    if (onDelete) {
      actions.push({
        label: 'Delete product',
        icon: <Trash2Icon aria-hidden className="size-4" />,
        onSelect: () => onDelete(feature),
        destructive: true,
      })
    }
    return actions
  }

  return (
    <EntityList<Feature>
      label="Products"
      noun="products"
      rows={features}
      total={total}
      columns={columns}
      getRowId={(feature) => feature.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search products…"
      filter={{
        fields: FILTER_FIELDS,
        query: createFilterQuery(filterRules),
        activeCount: query.types.length > 0 ? 1 : 0,
        onQueryChange: (_next, flat: FlatFilter[]) => {
          const types = (flat.find((entry) => entry.field === 'type')?.values ?? [])
            .map(String)
            .filter((value): value is FeatureType => TYPES.has(value))
          onQueryChange({ ...query, types, page: 1 })
        },
      }}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({
            ...query,
            sortBy: sortBy as FeatureSortField,
            sortDirection,
            page: 1,
          }),
      }}
      rowActions={rowActions}
      exportFileName="products"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden />
            New product
          </Button>
        ) : undefined
      }
      {...(onFeatureClick ? { onRowClick: onFeatureClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.types.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No products match these filters"
      empty={{
        title: 'Nothing is being measured yet',
        description:
          'A product is what you meter or gate — API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create.',
        ...(onCreate
          ? {
              actions: (
                <Button onClick={onCreate}>
                  <PlusIcon aria-hidden />
                  New product
                </Button>
              ),
            }
          : {}),
        guides: GUIDES,
      }}
    />
  )
}
