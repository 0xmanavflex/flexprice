import type { ListFilter, ListFilterSpec } from './listFilter'
/**
 * An add-on, as the list reads it.
 *
 * V1's addon is "a plan that cannot be sold alone": the same name/lookup/status
 * shell, the same charges and entitlements attached afterwards. This is only the
 * list's read model; the charges the editor shares with plans are a later
 * surface.
 */
import { z } from 'zod'

export const AddonStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type AddonStatus = (typeof AddonStatus)[keyof typeof AddonStatus]

export const ADDON_STATUS_LABEL: Record<AddonStatus, string> = {
  [AddonStatus.Published]: 'Published',
  [AddonStatus.Archived]: 'Archived',
}

export interface Addon {
  id: string
  name: string
  lookupKey: string
  description: string
  status: AddonStatus
  /** How many charges (prices) the add-on carries. */
  chargeCount: number
  /** Of those, how many are a fixed fee, and how many metered usage. */
  fixedChargeCount: number
  usageChargeCount: number
  /** Free-form key/value fields; absent or empty when none. */
  metadata?: Record<string, string>
  createdAt: Date | null
  updatedAt: Date | null
}

export const AddonSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type AddonSortField = (typeof AddonSortField)[keyof typeof AddonSortField]

export const ADDON_SORT_LABEL: Record<AddonSortField, string> = {
  [AddonSortField.Name]: 'Name',
  [AddonSortField.CreatedAt]: 'Created',
  [AddonSortField.UpdatedAt]: 'Updated',
}

/** Table or cards. A layout, not a filter: kept out of the fetch key. */
export const AddonView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type AddonView = (typeof AddonView)[keyof typeof AddonView]

export interface AddonQuery {
  page: number
  pageSize: number
  search: string
  statuses: AddonStatus[]
  sortBy: AddonSortField
  sortDirection: 'asc' | 'desc'
  view: AddonView
  /** Granular field filters, applied by the search endpoint. See `ADDON_FILTERS`. */
  filters?: ListFilter[]
}

export const DEFAULT_ADDON_QUERY: AddonQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: AddonSortField.UpdatedAt,
  sortDirection: 'desc',
  view: AddonView.Table,
  filters: [],
}

/** Whether the list is narrowed: a search, the status facet or a filter chip. */
export function isAddonQueryFiltered(query: AddonQuery): boolean {
  return query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
}
/** What the add-on list can filter on: V1's fields, by their wire names. */
export const ADDON_FILTERS: readonly ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'lookup_key', label: 'Lookup key', kind: 'text' },
  {
    field: 'status',
    label: 'Status',
    kind: 'options',
    options: [
      { value: 'published', label: 'Published' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  { field: 'created_at', label: 'Created', kind: 'date' },
]

/**
 * The rules for creating or editing an add-on's details.
 *
 * The details step only: name, the stable lookup key, a description. The
 * charges and entitlements an add-on carries are the surface it shares with a
 * plan, added after the shell exists, the same way V1's drawer creates the
 * add-on and a separate page prices it.
 *
 * `lookupKey` is required here because the create endpoint requires it; on an
 * edit it is fixed (the update endpoint does not accept a new one: integrations
 * key off it), so the form shows it read-only rather than dropping it from the
 * schema.
 */
export const createAddonSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  lookupKey: z
    .string()
    .trim()
    .min(1, 'Enter a lookup key')
    .regex(/^[a-z0-9_-]+$/, 'Use lowercase letters, numbers, hyphens and underscores'),
  description: z.string().trim().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type CreateAddon = z.infer<typeof createAddonSchema>

/** A blank draft, so the create form starts on a valid, empty shape. */
export function emptyAddon(): CreateAddon {
  return { name: '', lookupKey: '', description: '' }
}
