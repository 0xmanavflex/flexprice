import { useMemo } from 'react'
import { BookOpenIcon, CopyIcon, PencilIcon, PlusIcon, PuzzleIcon } from 'lucide-react'
import {
  ADDON_SORT_LABEL,
  ADDON_STATUS_LABEL,
  type Addon,
  type AddonQuery,
  AddonSortField,
  AddonStatus,
  DEFAULT_ADDON_QUERY,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../shared/EntityList'
import { type EntityColumn, dateColumn, idColumn, pillColumn, textColumn } from '../shared/cells'

/**
 * The add-on list, over the shared `EntityList`.
 *
 * **Three of the redesign's seven columns are not here.** An add-on's read
 * model is the name/key/status shell and nothing else — `AddonWire` carries no
 * `type`, no price and no subscriber count, because an add-on's charges are
 * the surface it shares with a plan and are attached after the shell exists.
 * So `Type (Recurring/One-time)`, `Price` and `Subscribers` have no field to
 * read. The redesign's gap list names `Subscribers`; the other two turned up
 * checking `AddonWire`.
 *
 * They are omitted rather than dashed. A column whose every row is an em dash
 * spends width promising a value that will never arrive, and three of them
 * would leave a table that looks broken rather than one that is honest.
 * `Description` takes their place — it is real, it was on the previous grid,
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

/** `all` is a value, not the absence of one — a Select with an empty value
 *  renders its placeholder and reads as unset. */
const STATUS_ALL = 'all'

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
    title: 'Adding one to a subscription',
    description: 'Put an add-on on a live subscription and see it billed.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/addons/add-to-subscription',
    icon: <PlusIcon aria-hidden className="size-4" />,
  },
]

/** Counts per status, from the server. Undefined where not yet known — a
 *  confident "0" that has not been confirmed is worse than no number. */
export interface AddonStatusCounts {
  total?: number | undefined
  published?: number | undefined
  archived?: number | undefined
}

export interface AddonGridProps {
  addons: Addon[]
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
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  /** Fills the counts beside each status option. */
  statusCounts?: AddonStatusCounts | undefined
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
  onClearFilters,
  statusCounts,
  locale,
}: AddonGridProps) {
  const columns = useMemo<EntityColumn<Addon>[]>(
    () => [
      textColumn<Addon>('name', 'Add-on', (row) => row.name, {
        width: 240,
        sortable: true,
        sortValue: AddonSortField.Name,
        hideable: false,
      }),
      idColumn<Addon>('lookupKey', 'Key', (row) => row.lookupKey, { width: 180 }),
      textColumn<Addon>('description', 'Description', (row) => row.description, {
        width: 280,
        muted: true,
      }),
      pillColumn<Addon>(
        'status',
        'Status',
        (row) => ({
          label: ADDON_STATUS_LABEL[row.status],
          tone: row.status === AddonStatus.Published ? 'success' : 'neutral',
        }),
        { width: 130 },
      ),
      dateColumn<Addon>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: AddonSortField.UpdatedAt,
        ...(locale ? { locale } : {}),
      }),
      // Real, and on the old grid, but not in the redesign's default layout.
      dateColumn<Addon>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: AddonSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const statusValue = query.statuses.length === 1 ? (query.statuses[0] ?? STATUS_ALL) : STATUS_ALL

  const isDefaultSort =
    query.sortBy === DEFAULT_ADDON_QUERY.sortBy &&
    query.sortDirection === DEFAULT_ADDON_QUERY.sortDirection

  const rowActions = (addon: Addon): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onAddonClick) {
      actions.push({
        label: 'View add-on',
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
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(addon.id),
    })
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
      status={{
        value: statusValue,
        label: 'Status',
        onChange: (value) =>
          onQueryChange({
            ...query,
            statuses: value === STATUS_ALL ? [] : [value as AddonStatus],
            page: 1,
          }),
        options: [
          {
            value: STATUS_ALL,
            label: 'All',
            ...(statusCounts?.total === undefined ? {} : { count: statusCounts.total }),
          },
          {
            value: AddonStatus.Published,
            label: ADDON_STATUS_LABEL[AddonStatus.Published],
            ...(statusCounts?.published === undefined ? {} : { count: statusCounts.published }),
          },
          {
            value: AddonStatus.Archived,
            label: ADDON_STATUS_LABEL[AddonStatus.Archived],
            ...(statusCounts?.archived === undefined ? {} : { count: statusCounts.archived }),
          },
        ],
      }}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({ ...query, sortBy: sortBy as AddonSortField, sortDirection, page: 1 }),
      }}
      selectable
      rowActions={rowActions}
      exportFileName="add-ons"
      primaryAction={onCreate ? <Button onClick={onCreate}>New add-on</Button> : undefined}
      {...(onAddonClick ? { onRowClick: onAddonClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={query.search.length > 0 || query.statuses.length > 0}
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No add-ons match these filters"
      empty={{
        title: 'No add-ons yet',
        description:
          'An add-on is a priced extra sold alongside a plan — extra seats, a support tier, a burst of capacity. Create the shell here, then give it charges.',
        ...(onCreate ? { actions: <Button onClick={onCreate}>New add-on</Button> } : {}),
        guides: GUIDES,
      }}
    />
  )
}
