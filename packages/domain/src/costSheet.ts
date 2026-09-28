/**
 * A cost sheet, as the list reads it.
 *
 * A cost sheet records what each unit of usage costs you, grouped as a set of
 * prices, so margin can be measured against what you charge. V1 keeps the
 * fields across a drawer and a read-only detail page; this is only the list's
 * read model. The editor that reunites them is a later surface, the same way
 * plans and add-ons split.
 *
 * Two shapes cross this boundary that transport does not: the number of prices
 * is carried as a count (never the wire's `prices` array, which the list never
 * enumerates), and status collapses to the two a catalogue shows.
 */
export const CostSheetStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type CostSheetStatus = (typeof CostSheetStatus)[keyof typeof CostSheetStatus]

export const COST_SHEET_STATUS_LABEL: Record<CostSheetStatus, string> = {
  [CostSheetStatus.Published]: 'Published',
  [CostSheetStatus.Archived]: 'Archived',
}

/** The read model the list and cards render. */
export interface CostSheet {
  id: string
  name: string
  /** The stable key the cost sheet is referenced by. Empty when it has none. */
  lookupKey: string
  /** A one-line description of what the cost sheet covers. Empty when it has none. */
  description: string
  /** How many prices the cost sheet groups. */
  priceCount: number
  status: CostSheetStatus
  createdAt: Date | null
  updatedAt: Date | null
}

export const CostSheetSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type CostSheetSortField = (typeof CostSheetSortField)[keyof typeof CostSheetSortField]

export const COST_SHEET_SORT_LABEL: Record<CostSheetSortField, string> = {
  [CostSheetSortField.Name]: 'Name',
  [CostSheetSortField.CreatedAt]: 'Created',
  [CostSheetSortField.UpdatedAt]: 'Updated',
}

/** Table or cards. A layout, not a filter — kept out of the fetch key. */
export const CostSheetView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type CostSheetView = (typeof CostSheetView)[keyof typeof CostSheetView]

export interface CostSheetQuery {
  page: number
  pageSize: number
  search: string
  statuses: CostSheetStatus[]
  sortBy: CostSheetSortField
  sortDirection: 'asc' | 'desc'
  view: CostSheetView
}

export const DEFAULT_COST_SHEET_QUERY: CostSheetQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: CostSheetSortField.Name,
  sortDirection: 'asc',
  view: CostSheetView.Table,
}
