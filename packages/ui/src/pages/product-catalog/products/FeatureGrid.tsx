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
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  type Feature,
  type FeatureQuery,
  FeatureSortField,
  FEATURE_FILTERS,
} from '@fp/domain'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { WriteGate } from '@ui/compositions/access/Access'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  EmDash,
  EntityCell,
  FeatureTypePill,
  Formula,
  Pill,
  Status,
  Tag,
  type EntityColumn,
  dateColumn,
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

/**
 * How a feature is wired into the catalogue, as the grid shows it.
 *
 * Read from elsewhere (entitlements, plans, subscriptions) and handed in per
 * feature id, so the grid stays a table and never becomes a data loader. A
 * feature with no entry is still loading its linkage; `subscriptions` is
 * undefined when it could not be counted, which is not the same as zero.
 */
export interface FeatureLinkage {
  plans: { id: string; name: string }[]
  entitlements: number
  subscriptions: number | undefined
}

/** Chips shown before the rest collapse into "+N". */
const VISIBLE_PLAN_CHIPS = 2

export interface FeatureGridProps {
  features: Feature[]
  /**
   * A group id as its name, for the Group chip.
   *
   * Resolved by the page: `POST /features/search` refuses `expand=groups`
   * (checked — it answers 400 "Field is not allowed to be expanded"), so the
   * feature carries only `groupId` and the names are fetched alongside.
   */
  groupName?: ((groupId: string) => string | undefined) | undefined
  /** Plans, entitlements and subscriptions per feature id. */
  linkage?: ReadonlyMap<string, FeatureLinkage>
  /** The linkage is still being read; its three columns show a placeholder. */
  linkageLoading?: boolean
  /** The "Add entitlement" action on a feature no plan grants yet. */
  onCreateEntitlement?: (feature: Feature) => void
  total: number
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onFeatureClick?: (feature: Feature) => void
  /** The primary create action; renders a "New feature" CTA at the toolbar's end. */
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
  groupName,
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
  locale,
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
          width: 200,
          sortable: true,
          sortValue: FeatureSortField.Name,
          // The column the list is *for*. Hiding it leaves a table of
          // attributes belonging to nothing.
          hideable: false,
        }),
        cell: (row) => <EntityCell name={row.name} />,
      },
      // The lookup key, as the redesign lists it: the stable handle code uses.
      // Off by default in the handoff's column set; still one click away.
      idColumn<Feature>('lookupKey', 'Key', (row) => row.lookupKey, {
        width: 180,
        sortable: true,
        sortValue: FeatureSortField.LookupKey,
        hiddenByDefault: true,
      }),
      {
        // The glyph depends on the row, so the cell is written here rather
        // than through `pillColumn`, which takes one spec per row.
        id: 'type',
        header: 'Type',
        width: 110,
        sortable: true,
        sortValue: FeatureSortField.Type,
        text: (row) => FEATURE_TYPE_LABEL[row.type],
        cell: (row) => <FeatureTypePill type={row.type} label={FEATURE_TYPE_LABEL[row.type]} />,
        skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
      },
      idColumn<Feature>('eventName', 'Event name', (row) => row.eventName, { width: 200 }),
      {
        id: 'aggregation',
        header: 'Aggregation',
        width: 210,
        text: (row) => aggregationFormula(row) ?? '',
        cell: (row) => <Formula value={aggregationFormula(row)} />,
        skeleton: <Skeleton className="h-6 w-32 rounded-md" />,
      },
      {
        // The label the feature is filed under, as a chip.
        id: 'group',
        header: 'Group',
        width: 140,
        text: (row) => (row.groupId ? (groupName?.(row.groupId) ?? row.groupId) : ''),
        cell: (row) => {
          if (!row.groupId) return <EmDash />
          const name = groupName?.(row.groupId)
          // The id until the names arrive — never a blank cell for a feature
          // that does have a group.
          return <Tag>{name ?? row.groupId}</Tag>
        },
        skeleton: <Skeleton className="h-6 w-20 rounded-full" />,
      },
      // The unit a metered feature counts in; non-metered features have none.
      {
        id: 'unit',
        header: 'Unit',
        width: 100,
        hiddenByDefault: true,
        text: (row) => row.unitSingular,
        cell: (row) =>
          row.unitSingular ? (
            <span className="text-muted-foreground">{row.unitSingular}</span>
          ) : (
            <EmDash />
          ),
        skeleton: <Skeleton className="h-4 w-12" />,
      },
      {
        id: 'plans',
        header: 'Used in',
        width: 200,
        hiddenByDefault: true,
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
        align: 'center',
        text: (row) => String(linkage?.get(row.id)?.entitlements ?? ''),
        cell: (row) => {
          const entry = linkage?.get(row.id)
          if (!entry)
            return linkageLoading ? <Skeleton className="h-6 w-20 rounded-full" /> : <EmDash />
          if (entry.entitlements > 0) {
            return (
              <span className="tabular-nums">
                {new Intl.NumberFormat(locale).format(entry.entitlements)}
              </span>
            )
          }
          if (!onCreateEntitlement) return <EmDash />
          // `xs` (24px, the pill's height) so the action sits on the row's
          // centre line like the pills around it instead of crowding the cell.
          return (
            <div className="flex min-w-0 items-center">
              <WriteGate>
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
              </WriteGate>
            </div>
          )
        },
        skeleton: <Skeleton className="h-6 w-24 rounded-full" />,
      },
      {
        id: 'subscriptions',
        header: 'Contracts',
        width: 120,
        align: 'center',
        text: (row) => String(linkage?.get(row.id)?.subscriptions ?? ''),
        cell: (row) => {
          const entry = linkage?.get(row.id)
          if (!entry) return linkageLoading ? <Skeleton className="h-4 w-8" /> : <EmDash />
          if (!entry.subscriptions) return <EmDash />
          return <span className="tabular-nums">{entry.subscriptions.toLocaleString()}</span>
        },
        skeleton: <Skeleton className="h-4 w-8" />,
      },
      {
        id: 'status',
        header: 'Status',
        width: 110,
        // Removed from the default set by the handoff; status is a filter.
        hiddenByDefault: true,
        text: (row) => FEATURE_STATUS_LABEL[row.status],
        cell: (row) => <Status value={FEATURE_STATUS_LABEL[row.status]} />,
        skeleton: <Skeleton className="h-6 w-20 rounded-full" />,
      },
      // Real, and off by default exactly as the redesign has them — the layout
      // does not spend a column on either, but both stay in the `⋯` menu.
      dateColumn<Feature>('createdAt', 'Created', (row) => row.createdAt, {
        width: 130,
        sortable: true,
        sortValue: FeatureSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
      dateColumn<Feature>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 130,
        sortable: true,
        sortValue: FeatureSortField.UpdatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [linkage, linkageLoading, onCreateEntitlement, locale, groupName],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_FEATURE_QUERY.sortBy &&
    query.sortDirection === DEFAULT_FEATURE_QUERY.sortDirection

  const rowActions = (feature: Feature): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onFeatureClick) {
      actions.push({
        label: 'View feature',
        readOnly: true,
        icon: <GaugeIcon aria-hidden className="size-4" />,
        onSelect: () => onFeatureClick(feature),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Edit feature',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(feature),
      })
    }
    if (onCreateEntitlement) {
      // Keep Add entitlement available for features that already have grants.
      actions.push({
        label: 'Add entitlement',
        icon: <PlusIcon aria-hidden className="size-4" />,
        onSelect: () => onCreateEntitlement(feature),
      })
    }
    if (onClone) {
      actions.push({
        label: 'Clone feature',
        icon: <CopyPlusIcon aria-hidden className="size-4" />,
        onSelect: () => onClone(feature),
      })
    }
    actions.push({
      label: 'Copy feature ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(feature.id),
    })
    if (onDelete) {
      actions.push({
        label: 'Delete feature',
        icon: <Trash2Icon aria-hidden className="size-4" />,
        onSelect: () => onDelete(feature),
        destructive: true,
      })
    }
    return actions
  }

  return (
    <EntityList<Feature>
      label="Features"
      noun="features"
      rows={features}
      total={total}
      columns={columns}
      getRowId={(feature) => feature.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search features…"
      filter={granularFilter({
        specs: FEATURE_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
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
      exportFileName="features"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden />
            New feature
          </Button>
        ) : undefined
      }
      {...(onFeatureClick ? { onRowClick: onFeatureClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={
        query.search.length > 0 ||
        query.types.length > 0 ||
        query.statuses.length > 0 ||
        (query.filters?.length ?? 0) > 0
      }
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No features match these filters"
      empty={{
        scene: 'catalog',
        title: 'Nothing is being measured yet',
        description:
          'A feature is what you meter or gate — API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create.',
        guides: GUIDES,
      }}
    />
  )
}
