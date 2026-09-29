import { useMemo } from 'react'
import { BookOpenIcon, CopyIcon, GaugeIcon, ScrollTextIcon, SquareStackIcon } from 'lucide-react'
import {
  AGGREGATION_LABEL,
  DEFAULT_FEATURE_QUERY,
  FEATURE_SORT_LABEL,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  type Feature,
  type FeatureQuery,
  FeatureSortField,
  FeatureStatus,
  FeatureType,
} from '@fp/domain'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterNode } from '@ui/components/reui/filters/filters-types'
import type { FlatFilter } from '@ui/compositions/FilterBar'
import { Button } from '@ui/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from './EntityList'
import { FeatureTypePill, type EntityColumn, dateColumn, pillColumn, textColumn } from './cells'

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
  composes: ['flexprice/EntityList'],
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

/** The status dropdown's options. `all` is a value, not the absence of one —
 *  a Select with an empty value renders its placeholder and reads as unset. */
const STATUS_ALL = 'all'

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
    title: 'What a feature is',
    description: 'Metered, boolean and static features, and when to reach for each.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/features/use-cases',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Sending usage events',
    description: 'How a metered feature turns raw events into something billable.',
    href: 'https://docs.flexprice.io/api-reference/events/ingest-event',
    icon: <ScrollTextIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Pricing a feature',
    description: 'Attach a feature to a plan with a charge and an entitlement.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/features/linking-to-plans',
    icon: <SquareStackIcon aria-hidden className="size-4" />,
  },
]

/** Counts per status, from the server. Undefined where not yet known — a
 *  confident "0" that has not been confirmed is worse than no number. */
export interface FeatureStatusCounts {
  total?: number | undefined
  published?: number | undefined
  archived?: number | undefined
}

export interface FeatureGridProps {
  features: Feature[]
  total: number
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onFeatureClick?: (feature: Feature) => void
  /** The primary create action; renders a "New feature" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Fills the counts beside each status option. */
  statusCounts?: FeatureStatusCounts | undefined
  locale?: string
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
  onCreate,
  onClearFilters,
  statusCounts,
  locale,
}: FeatureGridProps) {
  const columns = useMemo<EntityColumn<Feature>[]>(
    () => [
      textColumn<Feature>('name', 'Feature', (row) => row.name, {
        width: 240,
        sortable: true,
        sortValue: FeatureSortField.Name,
        // The column the list is *for*. Hiding it leaves a table of
        // attributes belonging to nothing.
        hideable: false,
      }),
      pillColumn<Feature>(
        'type',
        'Type',
        (row) => ({ label: FEATURE_TYPE_LABEL[row.type] }),
        { width: 150 },
      ),
      pillColumn<Feature>('status', 'Status', (row) => ({
        label: FEATURE_STATUS_LABEL[row.status],
        tone: row.status === FeatureStatus.Published ? 'success' : 'neutral',
      })),
      textColumn<Feature>(
        'measurement',
        'Measured by',
        (row) => (row.aggregationType ? AGGREGATION_LABEL[row.aggregationType] : null),
        { width: 200 },
      ),
      textColumn<Feature>('unit', 'Unit', (row) => row.unitSingular, { width: 110 }),
      dateColumn<Feature>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: FeatureSortField.CreatedAt,
        ...(locale ? { locale } : {}),
      }),
      dateColumn<Feature>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: FeatureSortField.UpdatedAt,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  /*
   * The type pill carries its glyph rather than a dot, so the type is
   * recognisable before it is read. Patched over the helper's output because
   * the glyph depends on the row and `pillColumn` takes a spec per row —
   * which is exactly what this is.
   */
  const withGlyphs = useMemo<EntityColumn<Feature>[]>(
    () =>
      columns.map((column) =>
        column.id === 'type'
          ? {
              ...column,
              cell: (row: Feature) => (
                <FeatureTypePill type={row.type} label={FEATURE_TYPE_LABEL[row.type]} />
              ),
            }
          : column,
      ),
    [columns],
  )

  /* --- the filter builder's tree, rebuilt from the query every render, so
         the chips and the URL cannot drift --- */
  const filterRules: FilterNode[] = []
  if (query.types.length > 0) {
    filterRules.push(
      createFilterRule({ id: 'type', path: ['type'], operator: 'is_any_of', value: query.types }),
    )
  }

  const statusValue =
    query.statuses.length === 1 ? (query.statuses[0] ?? STATUS_ALL) : STATUS_ALL

  const isDefaultSort =
    query.sortBy === DEFAULT_FEATURE_QUERY.sortBy &&
    query.sortDirection === DEFAULT_FEATURE_QUERY.sortDirection

  const rowActions = (feature: Feature): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onFeatureClick) {
      actions.push({
        label: 'View feature',
        icon: <GaugeIcon aria-hidden className="size-4" />,
        onSelect: () => onFeatureClick(feature),
      })
    }
    actions.push({
      label: 'Copy feature ID',
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(feature.id),
    })
    return actions
  }

  return (
    <EntityList<Feature>
      label="Features"
      noun="features"
      rows={features}
      total={total}
      columns={withGlyphs}
      getRowId={(feature) => feature.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search features…"
      status={{
        value: statusValue,
        label: 'Status',
        onChange: (value) =>
          onQueryChange({
            ...query,
            statuses: value === STATUS_ALL ? [] : [value as FeatureStatus],
            page: 1,
          }),
        options: [
          { value: STATUS_ALL, label: 'All', ...(statusCounts?.total === undefined ? {} : { count: statusCounts.total }) },
          {
            value: FeatureStatus.Published,
            label: FEATURE_STATUS_LABEL[FeatureStatus.Published],
            ...(statusCounts?.published === undefined ? {} : { count: statusCounts.published }),
          },
          {
            value: FeatureStatus.Archived,
            label: FEATURE_STATUS_LABEL[FeatureStatus.Archived],
            ...(statusCounts?.archived === undefined ? {} : { count: statusCounts.archived }),
          },
        ],
      }}
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
      selectable
      rowActions={rowActions}
      exportFileName="features"
      primaryAction={onCreate ? <Button onClick={onCreate}>New feature</Button> : undefined}
      {...(onFeatureClick ? { onRowClick: onFeatureClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.types.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No features match these filters"
      empty={{
        title: 'Nothing is being measured yet',
        description:
          'A feature is what you meter or gate — API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create.',
        ...(onCreate ? { actions: <Button onClick={onCreate}>New feature</Button> } : {}),
        guides: GUIDES,
      }}
    />
  )
}
