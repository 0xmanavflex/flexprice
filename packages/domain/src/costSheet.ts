import type { ListFilter, ListFilterSpec } from './listFilter'
import { z } from 'zod'

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
  metadata?: Record<string, string>
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

/** Table or cards. A layout, not a filter: kept out of the fetch key. */
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
  /** Granular field filters, applied by the search endpoint. See `COST_SHEET_FILTERS`. */
  filters?: ListFilter[]
}

export const DEFAULT_COST_SHEET_QUERY: CostSheetQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: CostSheetSortField.UpdatedAt,
  sortDirection: 'desc',
  view: CostSheetView.Table,
  filters: [],
}
/** What the cost sheet list can filter on: V1's fields, by their wire names. */
export const COST_SHEET_FILTERS: readonly ListFilterSpec[] = [
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

const metadata = z.record(z.string(), z.string())

/**
 * A cost sheet draft. The lookup key is optional (the backend leaves it blank)
 * and free-form up to 255 characters, like the name.
 */
export const createCostSheetSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(255, 'Use 255 characters or fewer'),
  lookupKey: z.string().trim().max(255, 'Use 255 characters or fewer').optional(),
  description: z.string().trim().optional(),
  metadata: metadata.optional(),
})

export type CreateCostSheet = z.infer<typeof createCostSheetSchema>

/**
 * An edit is the same shape. The backend ignores a blank field on update rather
 * than clearing it, so a form cannot use this to empty a description or a key.
 */
export const editCostSheetSchema = createCostSheetSchema

export type EditCostSheet = CreateCostSheet

export function emptyCostSheet(): CreateCostSheet {
  return { name: '', lookupKey: '', description: '' }
}

/** An edit draft seeded from an existing cost sheet. */
export function costSheetToEdit(sheet: CostSheet): EditCostSheet {
  return {
    name: sheet.name,
    lookupKey: sheet.lookupKey,
    description: sheet.description,
    ...(sheet.metadata && Object.keys(sheet.metadata).length > 0
      ? { metadata: sheet.metadata }
      : {}),
  }
}
