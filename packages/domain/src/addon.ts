/**
 * An add-on, as the list reads it.
 *
 * V1's addon is "a plan that cannot be sold alone" — the same name/lookup/status
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

/** Table or cards. A layout, not a filter — kept out of the fetch key. */
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
}

export const DEFAULT_ADDON_QUERY: AddonQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: AddonSortField.Name,
  sortDirection: 'asc',
  view: AddonView.Table,
}

/**
 * The rules for creating or editing an add-on's details.
 *
 * The details step only — name, the stable lookup key, a description. The
 * charges and entitlements an add-on carries are the surface it shares with a
 * plan, added after the shell exists, the same way V1's drawer creates the
 * add-on and a separate page prices it.
 *
 * `lookupKey` is required here because the create endpoint requires it; on an
 * edit it is fixed (the update endpoint does not accept a new one — integrations
 * key off it), so the form shows it read-only rather than dropping it from the
 * schema.
 */
export const createAddonSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  lookupKey: z
    .string()
    .trim()
    .min(1, 'Enter a lookup key')
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
  description: z.string().trim().optional(),
})

export type CreateAddon = z.infer<typeof createAddonSchema>

/** A blank draft, so the create form starts on a valid, empty shape. */
export function emptyAddon(): CreateAddon {
  return { name: '', lookupKey: '', description: '' }
}
