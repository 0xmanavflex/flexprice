/**
 * A subscription, as the list reads it.
 *
 * A subscription puts a customer on a plan and runs their billing cycle. The
 * API's `SubscriptionResponse` carries the customer and plan as nested
 * expansions, a lifecycle `subscriptionStatus`, and a `billingPeriod` in
 * transport spelling (`MONTHLY`, `HALF_YEARLY`). None of that belongs in a grid
 * cell, so this is the narrow, total read model the list renders: names already
 * resolved, one status, and the billing period as a word a person reads.
 */

export const SubscriptionStatus = {
  Active: 'active',
  Trialing: 'trialing',
  Paused: 'paused',
  Cancelled: 'cancelled',
  Incomplete: 'incomplete',
} as const
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Active]: 'Active',
  [SubscriptionStatus.Trialing]: 'Trialing',
  [SubscriptionStatus.Paused]: 'Paused',
  [SubscriptionStatus.Cancelled]: 'Cancelled',
  [SubscriptionStatus.Incomplete]: 'Incomplete',
}

/** The read model the list renders. */
export interface Subscription {
  id: string
  customerId: string
  /** Display name, already resolved. The UI never joins data. */
  customerName: string
  planId: string
  planName: string
  status: SubscriptionStatus
  /** Currency code, uppercased. Empty when the API sends none. */
  currency: string
  /** The billing cadence as a word — "Monthly", "Half-yearly". */
  billingPeriodLabel: string
  currentPeriodEnd: Date | null
  startDate: Date | null
  createdAt: Date | null
}

export const SubscriptionSortField = {
  StartDate: 'startDate',
  CreatedAt: 'createdAt',
} as const
export type SubscriptionSortField =
  (typeof SubscriptionSortField)[keyof typeof SubscriptionSortField]

export const SUBSCRIPTION_SORT_LABEL: Record<SubscriptionSortField, string> = {
  [SubscriptionSortField.StartDate]: 'Started',
  [SubscriptionSortField.CreatedAt]: 'Created',
}

export interface SubscriptionQuery {
  page: number
  pageSize: number
  search: string
  statuses: SubscriptionStatus[]
  sortBy: SubscriptionSortField
  sortDirection: 'asc' | 'desc'
}

export const DEFAULT_SUBSCRIPTION_QUERY: SubscriptionQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: SubscriptionSortField.StartDate,
  sortDirection: 'desc',
}
