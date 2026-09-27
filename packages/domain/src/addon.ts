/**
 * An add-on, as the list reads it.
 *
 * V1's addon is "a plan that cannot be sold alone" — the same name/lookup/status
 * shell, the same charges and entitlements attached afterwards. This is only the
 * list's read model; the editor it shares with plans is a later surface.
 */

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
