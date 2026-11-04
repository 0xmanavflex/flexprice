import { useMemo } from 'react'
import {
  BookOpenIcon,
  CopyIcon,
  GaugeIcon,
  LayersIcon,
  TagIcon,
  Trash2Icon,
  PlusIcon,
} from '@ui/icons'
import {
  DOCS,
  DEFAULT_GROUP_QUERY,
  GROUP_ENTITY_TYPE_LABEL,
  GROUP_SORT_LABEL,
  GROUP_STATUS_LABEL,
  type Group,
  GroupEntityType,
  type GroupQuery,
  GroupSortField,
  GroupStatus,
  GROUP_FILTERS,
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
 * The group list, over the shared `EntityList`.
 *
 * Every column the redesign asks for exists on the read model: what the group
 * is called, whether it holds prices or features, how many it holds, its id
 * and when it last changed.
 *
 * **The "entity" filter is not here.** `GroupQuery` has no `entityTypes`
 * field, and `toGroupFilter` sends none: so a filter would have to narrow the
 * twenty-five rows already fetched while the footer kept reporting the
 * server's total, which is the failure `search.ts` was written to stop
 * repeating. The type is a column and a sort away from being useful; making
 * it a real filter needs a query field and a verified server-side condition,
 * not a client-side pass over one page.
 *
 * Worth noting against the redesign's copy: `GroupEntityType` is only
 * `price | feature`. There is no plan group and no add-on group to offer.
 *
 * **No counts beside the status options**: `useCatalogStats` does not cover
 * groups, and counting the rows on screen answers a different question.
 */
export const GroupGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Group columns and actions over the shared list table.',
})

const SORT_OPTIONS = Object.values(GroupSortField).map((value) => ({
  value,
  label: GROUP_SORT_LABEL[value],
}))

/** Every URL requested and returned 200; all three are in the docs sitemap. */
const GUIDES: EntityGuide[] = [
  {
    title: 'What a tag is',
    description: 'Bundling prices or features so they report and invoice together.',
    href: DOCS.groups,
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Creating a tag',
    description: 'Pick what it holds, name it, and add its members.',
    href: DOCS.groupCreate,
    icon: <LayersIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Grouping charges',
    description: 'How a price group changes what an invoice looks like.',
    href: DOCS.groupCharges,
    icon: <TagIcon aria-hidden className="size-4" />,
  },
]

export interface GroupGridProps {
  groups: Group[]
  total: number
  query: GroupQuery
  onQueryChange: (query: GroupQuery) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onGroupClick?: (group: Group) => void
  /** The primary create action; renders a "New group" CTA at the toolbar's end. */
  onCreate?: () => void
  /** Row menu: delete. Groups have no update route, so this and create are all there is. */
  onDelete?: ((group: Group) => void) | undefined
  /** Offered when a filter is what emptied the list. */
  onClearFilters?: () => void
  locale?: string
}

export function GroupGrid({
  groups,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onGroupClick,
  onCreate,
  onDelete,
  onClearFilters,
  locale,
}: GroupGridProps) {
  const columns = useMemo<EntityColumn<Group>[]>(
    () => [
      textColumn<Group>('name', 'Tag', (row) => row.name, {
        width: 240,
        sortable: true,
        sortValue: GroupSortField.Name,
        hideable: false,
      }),
      pillColumn<Group>(
        'entityType',
        'Entity type',
        (row) => ({
          label: GROUP_ENTITY_TYPE_LABEL[row.entityType],
          // A dot rather than a tone: neither kind of group is a better
          // outcome than the other, and colouring one green would say it was.
          icon:
            row.entityType === GroupEntityType.Feature ? (
              <GaugeIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
            ) : (
              <TagIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
            ),
        }),
        { width: 150 },
      ),
      numberColumn<Group>('members', 'Members', (row) => row.entityCount, {
        width: 120,
        ...(locale ? { locale } : {}),
      }),
      idColumn<Group>('id', 'ID', (row) => row.id, { width: 200 }),
      dateColumn<Group>('updatedAt', 'Updated', (row) => row.updatedAt, {
        width: 140,
        sortable: true,
        sortValue: GroupSortField.UpdatedAt,
        ...(locale ? { locale } : {}),
      }),
      // Real, and on the old grid, but not in the redesign's default layout.
      idColumn<Group>('lookupKey', 'Lookup key', (row) => row.lookupKey, {
        width: 180,
        hiddenByDefault: true,
      }),
      pillColumn<Group>(
        'status',
        'Status',
        (row) => ({
          label: GROUP_STATUS_LABEL[row.status],
          tone: row.status === GroupStatus.Published ? 'success' : 'neutral',
        }),
        { width: 130, hiddenByDefault: true },
      ),
      dateColumn<Group>('createdAt', 'Created', (row) => row.createdAt, {
        width: 140,
        sortable: true,
        sortValue: GroupSortField.CreatedAt,
        hiddenByDefault: true,
        ...(locale ? { locale } : {}),
      }),
    ],
    [locale],
  )

  const isDefaultSort =
    query.sortBy === DEFAULT_GROUP_QUERY.sortBy &&
    query.sortDirection === DEFAULT_GROUP_QUERY.sortDirection

  const rowActions = (group: Group): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onGroupClick) {
      actions.push({
        label: 'View tag',
        readOnly: true,
        icon: <LayersIcon aria-hidden className="size-4" />,
        onSelect: () => onGroupClick(group),
      })
    }
    actions.push({
      label: 'Copy tag ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(group.id),
    })
    if (onDelete) {
      actions.push({
        label: 'Delete tag',
        icon: <Trash2Icon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => onDelete(group),
      })
    }
    return actions
  }

  return (
    <EntityList<Group>
      label="Tags"
      noun="tags"
      rows={groups}
      total={total}
      columns={columns}
      getRowId={(group) => group.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search tags…"
      /*
       * No filter control. `useGroups` applies status on the page: "Status is
       * not a server-side filter here" (query/src/groups.ts): so a filter
       * would narrow the rows already fetched while the footer went on
       * reporting the server's total. That mismatch is the reason
       * `NoEntityFilter` exists, and it fails the moment one is added.
       */
      filter={granularFilter({
        specs: GROUP_FILTERS,
        filters: query.filters ?? [],
        onChange: (filters) => onQueryChange({ ...query, filters, page: 1 }),
      })}
      sort={{
        options: SORT_OPTIONS,
        field: query.sortBy,
        direction: query.sortDirection,
        activeCount: isDefaultSort ? 0 : 1,
        onChange: (sortBy, sortDirection) =>
          onQueryChange({ ...query, sortBy: sortBy as GroupSortField, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      exportFileName="groups"
      primaryAction={
        onCreate ? (
          <Button onClick={onCreate}>
            <PlusIcon aria-hidden />
            New tag
          </Button>
        ) : undefined
      }
      {...(onGroupClick ? { onRowClick: onGroupClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={
        query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
      }
      {...(onClearFilters ? { onClearFilters } : {})}
      filteredEmptyTitle="No tags match these filters"
      empty={{
        scene: 'settings',
        title: 'No tags yet',
        description:
          'A tag bundles prices or features so they can be filtered, reported and invoiced together: a product line, a region, a tier.',
        guides: GUIDES,
      }}
    />
  )
}
