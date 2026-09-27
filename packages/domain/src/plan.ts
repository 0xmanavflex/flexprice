/**
 * A plan, as the list and detail pages read it. Narrow and total.
 *
 * V1 splits a plan across four containers — a drawer for name, a separate page
 * for charges, a drawer on a tab for entitlements, a modal for credit grants.
 * This is only the *read* model the catalogue list needs; the editor that
 * reunites those four is a separate, later surface. Keeping the list model small
 * is what lets the grid stay the same shape as every other list here.
 */

export const PlanStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus]

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  [PlanStatus.Published]: 'Published',
  [PlanStatus.Archived]: 'Archived',
}

/**
 * A representative price for the pricing-card view.
 *
 * A plan can carry many charges; the card shows one headline the way a pricing
 * page does — the recurring base where there is one, else the first charge. The
 * `amount` is the string the API already formatted (`$29`), never a float, and
 * `period` is the raw billing enum the card shortens for display.
 */
export interface PlanHeadline {
  amount: string
  period: string
}

/** The read model the list and detail pages render. */
export interface Plan {
  id: string
  name: string
  lookupKey: string
  description: string
  status: PlanStatus
  /** How many charges (prices) the plan carries. 0 means it bills nothing yet. */
  chargeCount: number
  /** The pricing-card headline, or null when the plan prices nothing yet. */
  headline: PlanHeadline | null
  createdAt: Date | null
  updatedAt: Date | null
}

/**
 * What the list can be sorted by. The three the API's `sort` accepts and a
 * person would ask for — named in product terms, mapped to wire names in
 * `@fp/query`.
 */
export const PlanSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type PlanSortField = (typeof PlanSortField)[keyof typeof PlanSortField]

export const PLAN_SORT_LABEL: Record<PlanSortField, string> = {
  [PlanSortField.Name]: 'Name',
  [PlanSortField.CreatedAt]: 'Created',
  [PlanSortField.UpdatedAt]: 'Updated',
}

/** Table or cards. A layout, not a filter — kept out of the fetch key. */
export const PlanView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type PlanView = (typeof PlanView)[keyof typeof PlanView]

/** What the list can ask for. Product vocabulary, not transport. */
export interface PlanQuery {
  page: number
  pageSize: number
  search: string
  statuses: PlanStatus[]
  sortBy: PlanSortField
  sortDirection: 'asc' | 'desc'
  view: PlanView
}

export const DEFAULT_PLAN_QUERY: PlanQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  // Alphabetical: a catalogue is looked *up* more often than scanned for change.
  sortBy: PlanSortField.Name,
  sortDirection: 'asc',
  view: PlanView.Table,
}
