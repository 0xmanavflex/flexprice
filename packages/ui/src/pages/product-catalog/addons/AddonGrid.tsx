import { useMemo } from 'react'
import { BookOpenIcon, CopyIcon, PencilIcon, PlusIcon, PuzzleIcon, ArchiveIcon } from '@ui/icons'
import {
  ADDON_SORT_LABEL,
  ADDON_STATUS_LABEL,
  type Addon,
  type AddonQuery,
  AddonSortField,
  AddonStatus,
  DEFAULT_ADDON_QUERY,
  ADDON_FILTERS,
  planKind,
  planKindLabel,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { provenance } from '@ui/provenance'
import { granularFilter } from '@ui/compositions/tables/FilterBar'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import {
  EmDash,
  Tag,
  type EntityColumn,
  dateColumn,
  idColumn,
  pillColumn,
  textColumn,
} from '../../shared/cells'

/** A figure, or a dash: zero and unknown read the same, as on the plans grid. */
function count(value: number | undefined, locale: string | undefined) {
  if (!value) return <EmDash />
  return <span className="tabular-nums">{new Intl.NumberFormat(locale).format(value)}</span>
}

/**
 * The add-on list, over the shared `EntityList`.
 *
 * **Three of the redesign's seven columns are not here.** An add-on's read
 * model is the name/key/status shell and nothing else: `AddonWire` carries no
 * `type`, no price and no subscriber count, because an add-on's charges are
 * the surface it shares with a plan and are attached after the shell exists.
 * So `Type (Recurring/One-time)`, `Price` and `Subscribers` have no field to
 * read. The redesign's gap list names `Subscribers`; the other two turned up
 * checking `AddonWire`.
 *
 * They are omitted rather than dashed. A column whose every row is an em dash
 * spends width promising a value that will never arrive, and three of them
 * would leave a table that looks broken rather than one that is honest.
 * `Description` takes their place: it is real, it was on the previous grid,
 * and without it an add-on row is four columns of metadata with nothing
 * saying what the add-on *is*.
 *
 * Status is in the toolbar's dropdown and *not* in the filter builder, so two
 * controls cannot disagree about `query.statuses`.
 */
export const AddonGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Add-on columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(AddonSortField).map((value) => ({
  value,
  label: ADDON_SORT_LABEL[value],
}))

/** Every URL requested and returned 200; all three are in the docs sitemap. */
const GUIDES: EntityGuide[] = [
  {
    title: 'What an add-on is',
    description: 'A priced extra a customer buys alongside a plan, never on its own.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/addons/overview',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Creating an add-on',
    description: 'Name it, give it a lookup key, then attach its charges.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/addons/create',
    icon: <PuzzleIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Adding one to a contract',
    description: 'Put an add-on on a live contract and see it billed.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/addons/add-to-subscription',
    icon: <PlusIcon aria-hidden className="size-4" />,
  },
]

/**
 * What an add-on contains, as the grid shows it.
 *
 * Contracts are absent on purpose: see `useAddonLinkage`; the subscriptions
 * search ignores an add-on filter, so the figure cannot be read.
 */
export interface AddonLinkage {
  entitlements: number | undefined
}

export interface AddonGridProps {
  addons: Addon[]
  /** Entitlement counts per add-on id. */
  linkage?: ReadonlyMap<string, AddonLinkage>
  /** The linkage is still being read; its column shows a placeholder. */
  linkageLoading?: boolean
  total: number
  query: AddonQuery
  onQueryChange: (query: AddonQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onAddonClick?: (addon: Addon) => void
  /** The primary create action; renders a "New add-on" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: open the add-on's editor. Left out of the menu when absent. */
  onEdit?: ((addon: Addon) => void) | undefined
  /** Row menu: archive. Rendered destructive, last. */
  onArchive?: ((addon: Addon) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

export function AddonGrid({
  addons,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onAddonClick,
  onCreate,
  onEdit,
  onArchive,
  onClearFilters,
  locale,
  linkage,
  linkageLoading = false,
}: AddonGridProps) {
  const columns = useMemo<EntityColumn<Addon>[]>(
    () => [
      textColumn<Addon>('name', 'Add-on', (row) => row.name, {
        width: 200,
        sortable: true,
        sortValue: AddonSortField.Name,
        hideable: false,
      }),
      {
        // Read off the charge mix, as on plans: the same question, a
        // different noun, so "Hybrid add-on" rather than "Hybrid plan".
        id: 'kind',
        header: 'Type',
        width: 170,
        text: (row) => planKindLabel(planKind(row), ''),
        cell: (row) => <Tag>{planKindLabel(planKind(row), '')}</Tag>,
        skeleton: <Skeleton className="h-6 w-28 rounded-full" />,
      },
      {
        id: 'charges',
        header: 'Charges',
        width: 100,
        align: 'center',
        text: (row) => String(row.chargeCount),
        cell: (row) => count(row.chargeCount, locale),
        skeleton: <Skeleton className="h-4 w-8" />,
      },
      {
        id: 'entitlements',
        header: 'Entitlements',
        width: 120,
        align: 'center',
        text: (row) => {
          const value = linkage?.get(row.id)?.entitlements
          return value === undefined ? '' : String(value)
        },
        cell: (row) => {
          const value = linkage?.get(row.id)?.entitlements
          if (value === undefined && linkageLoading) return <Skeleton className="h-4 w-8" />
          return count(value, locale)
        },
        skeleton: <Skeleton className="h-4 w-8" />,
      },
      pillColumn<Addon>(
        'status',
        'Status',
        (row) => ({
          label: ADDON_STATUS_LABEL[row.status],
          tone: row.status === AddonStatus.Published ? 'success' : 'neutral',
        }),
        { width: 110 },
      ),
      idColumn<Addon>('lookupKey', 'Lookup key', (row) => row.lookupKey, { width: 180 }),
      // Real, and on the old grid, but not in the redesign's default layout.
      textColumn<Addon>('description', 'Description', (row) => row.description, {
        width: 280,
        muted: true,
        hiddenByDefault: true,
      }),
      dateColumn<Addon>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: AddonSortField.UpdatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
      dateColumn<Addon>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: AddonSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale, linkage, linkageLoading],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_ADDON_QUERY.sortBy &&
    query.sortDirection === DEFAULT_ADDON_QUERY.sortDirection

  const rowActions = (addon: Addon): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onAddonClick) {
      actions.push({
        label: 'View add-on',
        readOnly: true,
        icon: <PuzzleIcon aria-hidden className="size-4" />,
        onSelect: () => onAddonClick(addon),
      })
    }
    if (onEdit) {
      actions.push({
        label: 'Edit add-on',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEdit(addon),
      })
    }
    actions.push({
      label: 'Copy add-on ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(addon.id),
    })
    if (onArchive && addon.status !== AddonStatus.Archived) {
      actions.push({
        label: 'Archive add-on',
        icon: <ArchiveIcon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onArchive(addon),
      })
    }
    return actions
  }

  return (
    <EntityList<Addon>
      label="Add-ons"
      noun="add-ons"
      rows={addons}
      total={total}
      columns={columns}
      getRowId={(addon) => addon.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search add-ons…"
      filter={granularFilter({
        specs: ADDON_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({ ...query, sortBy: sortBy as AddonSortField, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      exportFileName="add-ons"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden />
            New add-on
          </Button>
        ) : undefined
      }
      {...(onAddonClick ? { onRowClick: onAddonClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={
        query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
      }
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No add-ons match these filters"
      empty={{
        scene: 'catalog',
        title: 'No add-ons yet',
        description:
          'An add-on is a priced extra sold alongside a plan: extra seats, a support tier, a burst of capacity. Create the shell here, then give it charges.',
        guides: GUIDES,
      }}
    />
  )
}
