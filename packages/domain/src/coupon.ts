/**
 * A coupon, as the list reads it.
 *
 * A coupon is a discount a customer redeems — a fixed amount off, or a
 * percentage — applied once, for a set number of periods, or forever. V1 keeps
 * the fields across a drawer and a read-only detail page; this is only the
 * list's read model. The editor that reunites them is a later surface, the same
 * way plans and add-ons split.
 *
 * Two shapes cross this boundary that transport does not: a fixed discount is a
 * domain `Money` (never the API's bare `amount_off` string beside a separate
 * `currency`), and status collapses to the two a catalogue shows.
 */
import type { Money } from './money'

export const CouponStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type CouponStatus = (typeof CouponStatus)[keyof typeof CouponStatus]

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  [CouponStatus.Published]: 'Published',
  [CouponStatus.Archived]: 'Archived',
}

/** Fixed amount off, or a percentage. The wire's `type`, unchanged. */
export const CouponType = {
  Fixed: 'fixed',
  Percentage: 'percentage',
} as const
export type CouponType = (typeof CouponType)[keyof typeof CouponType]

export const COUPON_TYPE_LABEL: Record<CouponType, string> = {
  [CouponType.Fixed]: 'Fixed',
  [CouponType.Percentage]: 'Percentage',
}

/**
 * How long the discount lasts once redeemed.
 *
 * `repeated` is the only one that reads with a number beside it — "3 periods" —
 * so `durationInPeriods` is meaningful there and ignored for the other two.
 */
export const CouponCadence = {
  Once: 'once',
  Repeated: 'repeated',
  Forever: 'forever',
} as const
export type CouponCadence = (typeof CouponCadence)[keyof typeof CouponCadence]

export const COUPON_CADENCE_LABEL: Record<CouponCadence, string> = {
  [CouponCadence.Once]: 'One-time',
  [CouponCadence.Repeated]: 'Repeating',
  [CouponCadence.Forever]: 'Forever',
}

/** The read model the list and cards render. */
export interface Coupon {
  id: string
  name: string
  /** The redemption code a customer types. Empty when the coupon has none. */
  code: string
  type: CouponType
  /** The amount off, for a fixed coupon. Null for a percentage coupon. */
  amountOff: Money | null
  /** The percentage off as the API sends it — `"10"`, not `0.1`. Null for fixed. */
  percentageOff: string | null
  cadence: CouponCadence
  /** How many periods a `repeating` discount lasts. Null otherwise. */
  durationInPeriods: number | null
  /** The redemption ceiling, or null when redemptions are unlimited. */
  maxRedemptions: number | null
  totalRedemptions: number
  redeemAfter: Date | null
  redeemBefore: Date | null
  status: CouponStatus
  createdAt: Date | null
  updatedAt: Date | null
}

export const CouponSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type CouponSortField = (typeof CouponSortField)[keyof typeof CouponSortField]

export const COUPON_SORT_LABEL: Record<CouponSortField, string> = {
  [CouponSortField.Name]: 'Name',
  [CouponSortField.CreatedAt]: 'Created',
  [CouponSortField.UpdatedAt]: 'Updated',
}

/** Table or cards. A layout, not a filter — kept out of the fetch key. */
export const CouponView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type CouponView = (typeof CouponView)[keyof typeof CouponView]

export interface CouponQuery {
  page: number
  pageSize: number
  search: string
  statuses: CouponStatus[]
  sortBy: CouponSortField
  sortDirection: 'asc' | 'desc'
  view: CouponView
}

export const DEFAULT_COUPON_QUERY: CouponQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: CouponSortField.Name,
  sortDirection: 'asc',
  view: CouponView.Table,
}
