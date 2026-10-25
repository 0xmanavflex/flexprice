import type { ListFilter, ListFilterSpec } from './listFilter'
import { z } from 'zod'

/**
 * A group, as the list reads it.
 *
 * A group bundles catalogue entities: prices or features: so they can be
 * filtered, reported and invoiced together, the way a product line or a region
 * is. A group is of one kind: it holds prices, or it holds features, never both.
 * V1 keeps the fields across a drawer and a read-only detail page; this is only
 * the list's read model. The editor that reunites them is a later surface, the
 * same way plans and add-ons split.
 *
 * Two shapes cross this boundary that transport does not: the count of members
 * is carried as a number (never the wire's `entityIds` array, which the list
 * never enumerates), and status collapses to the two a catalogue shows.
 */
export const GroupStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type GroupStatus = (typeof GroupStatus)[keyof typeof GroupStatus]

export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  [GroupStatus.Published]: 'Published',
  [GroupStatus.Archived]: 'Archived',
}

/** What a group holds. The wire's `entity_type`, unchanged. */
export const GroupEntityType = {
  Price: 'price',
  Feature: 'feature',
} as const
export type GroupEntityType = (typeof GroupEntityType)[keyof typeof GroupEntityType]

export const GROUP_ENTITY_TYPE_LABEL: Record<GroupEntityType, string> = {
  [GroupEntityType.Price]: 'Prices',
  [GroupEntityType.Feature]: 'Features',
}

/** The read model the list and cards render. */
export interface Group {
  id: string
  name: string
  /** The stable key the group is referenced by. Empty when it has none. */
  lookupKey: string
  /** Whether the group holds prices or features. */
  entityType: GroupEntityType
  /** How many entities the group holds. */
  entityCount: number
  /** The ids of what it holds: feature ids or price ids, by `entityType`. */
  entityIds?: string[]
  status: GroupStatus
  createdAt: Date | null
  updatedAt: Date | null
}

export const GroupSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type GroupSortField = (typeof GroupSortField)[keyof typeof GroupSortField]

export const GROUP_SORT_LABEL: Record<GroupSortField, string> = {
  [GroupSortField.Name]: 'Name',
  [GroupSortField.CreatedAt]: 'Created',
  [GroupSortField.UpdatedAt]: 'Updated',
}

/** Table or cards. A layout, not a filter: kept out of the fetch key. */
export const GroupView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type GroupView = (typeof GroupView)[keyof typeof GroupView]

export interface GroupQuery {
  page: number
  pageSize: number
  search: string
  statuses: GroupStatus[]
  sortBy: GroupSortField
  sortDirection: 'asc' | 'desc'
  view: GroupView
  /** Granular field filters, applied by the search endpoint. See `GROUP_FILTERS`. */
  filters?: ListFilter[]
  /**
   * Only the groups that hold this kind of thing.
   *
   * Server-side. The pickers want one kind: a feature form offers feature
   * labels, never price ones: and narrowing a fetched page in the browser
   * gets that wrong as soon as there are more groups than the page holds.
   */
  entityType?: GroupEntityType
}

export const DEFAULT_GROUP_QUERY: GroupQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: GroupSortField.UpdatedAt,
  sortDirection: 'desc',
  view: GroupView.Table,
  filters: [],
}
/** What the group list can filter on: V1's fields, by their wire names. */
export const GROUP_FILTERS: readonly ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'lookup_key', label: 'Lookup key', kind: 'text' },
  {
    field: 'entity_type',
    label: 'Holds',
    kind: 'options',
    options: [
      { value: 'price', label: 'Prices' },
      { value: 'feature', label: 'Features' },
    ],
  },
  { field: 'created_at', label: 'Created', kind: 'date' },
]

/**
 * A group draft. A group holds either prices or features, never both, so the
 * entity type is chosen at creation and cannot change; there is no update
 * route at all, which is why there is no edit schema.
 */
export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  lookupKey: z
    .string()
    .trim()
    .min(1, 'Enter a lookup key')
    .regex(/^[a-z0-9_-]+$/, 'Use lowercase letters, numbers, hyphens and underscores'),
  entityType: z.enum([GroupEntityType.Price, GroupEntityType.Feature]),
})

export type CreateGroup = z.infer<typeof createGroupSchema>

export function emptyGroup(entityType: GroupEntityType = GroupEntityType.Feature): CreateGroup {
  return { name: '', lookupKey: '', entityType }
}
