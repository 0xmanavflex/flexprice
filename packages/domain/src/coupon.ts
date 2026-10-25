import type { ListFilter, ListFilterSpec } from './listFilter'
/**
 * A coupon, as the list reads it.
 *
 * A coupon is a discount a customer redeems: a fixed amount off, or a
 * percentage: applied once, for a set number of periods, or forever. V1 keeps
 * the fields across a drawer and a read-only detail page; this is only the
 * list's read model. The editor that reunites them is a later surface, the same
 * way plans and add-ons split.
 *
 * Two shapes cross this boundary that transport does not: a fixed discount is a
 * domain `Money` (never the API's bare `amount_off` string beside a separate
 * `currency`), and status collapses to the two a catalogue shows.
 */
import { z } from 'zod'
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
 * `repeated` is the only one that reads with a number beside it: "3 periods":
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
  /** The percentage off as the API sends it: `"10"`, not `0.1`. Null for fixed. */
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
  /** Free-form string map, or null when the coupon carries none. */
  metadata: Record<string, string> | null
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

/** Table or cards. A layout, not a filter: kept out of the fetch key. */
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
  /** Granular field filters, applied by the search endpoint. See `COUPON_FILTERS`. */
  filters?: ListFilter[]
}

export const DEFAULT_COUPON_QUERY: CouponQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: CouponSortField.UpdatedAt,
  sortDirection: 'desc',
  view: CouponView.Table,
  filters: [],
}
/** What the coupon list can filter on: V1's fields, by their wire names. */
export const COUPON_FILTERS: readonly ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  {
    field: 'type',
    label: 'Type',
    kind: 'options',
    options: [
      { value: 'fixed', label: 'Fixed amount' },
      { value: 'percentage', label: 'Percentage' },
    ],
  },
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
 * The rules for editing a coupon.
 *
 * A coupon's money: its type, discount, cadence and redemption window: is
 * fixed once created (the API's `UpdateCouponRequest` accepts only `name` and
 * `metadata`), because a coupon already redeemed against live subscriptions
 * cannot change what it discounts underneath them. So the editor is a rename:
 * the detail page shows the discount read-only and this schema guards the one
 * field the API will take.
 */
export const editCouponSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type EditCoupon = z.infer<typeof editCouponSchema>

/**
 * Where a coupon is used: one subscription it is applied to.
 *
 * V1's detail page could not answer "where is this coupon in force"; the API
 * grew a `/coupons/associations` endpoint since, and this is the read model of
 * one association: which subscription, over what window, and whether it is
 * still active. The heavy expansions (the subscription's line items and their
 * prices) stay on the wire: this surface only needs to link back.
 */
export interface CouponAssociation {
  id: string
  subscriptionId: string
  status: CouponStatus
  startDate: Date | null
  endDate: Date | null
}

/**
 * A coupon draft. Flat rather than a union so the form can flip the type
 * without losing what was typed; the rules that depend on the type live in the
 * refinement, and the request mapper sends only the fields the type uses.
 *
 * Amounts are decimal strings: never numbers: and `percentageOff` is 0–100.
 * `durationInPeriods` is for `repeated` cadence only (the backend rejects it
 * otherwise). Redemption dates are `Date`s; the mapper serialises them.
 */
export const createCouponSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name'),
    couponCode: z.string().trim().optional(),
    type: z.enum([CouponType.Fixed, CouponType.Percentage]),
    amountOff: z.string().trim().optional(),
    currency: z.string().trim().optional(),
    percentageOff: z.string().trim().optional(),
    cadence: z.enum([CouponCadence.Once, CouponCadence.Repeated, CouponCadence.Forever]),
    durationInPeriods: z
      .number()
      .int('Must be a whole number')
      .positive('Must be greater than zero')
      .optional(),
    redeemAfter: z.date().optional(),
    redeemBefore: z.date().optional(),
    maxRedemptions: z
      .number()
      .int('Must be a whole number')
      .min(1, 'Must be at least 1')
      .max(1_000_000, 'Must be 1,000,000 or fewer')
      .optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((coupon, ctx) => {
    if (coupon.type === CouponType.Fixed) {
      if (!/^\d+(\.\d+)?$/.test(coupon.amountOff ?? '') || Number(coupon.amountOff) <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['amountOff'],
          message: 'Enter an amount greater than zero',
        })
      }
      if (!coupon.currency) {
        ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Choose a currency' })
      }
    } else {
      const value = coupon.percentageOff ?? ''
      if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0 || Number(value) > 100) {
        ctx.addIssue({
          code: 'custom',
          path: ['percentageOff'],
          message: 'Enter a percentage between 0 and 100',
        })
      }
    }

    if (coupon.cadence === CouponCadence.Repeated && coupon.durationInPeriods === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationInPeriods'],
        message: 'Enter how many billing periods it applies to',
      })
    }

    if (
      coupon.redeemAfter &&
      coupon.redeemBefore &&
      coupon.redeemAfter.getTime() > coupon.redeemBefore.getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['redeemBefore'],
        message: 'Must be after the start date',
      })
    }
  })

export type CreateCoupon = z.infer<typeof createCouponSchema>

export function emptyCoupon(): CreateCoupon {
  return {
    name: '',
    couponCode: '',
    type: CouponType.Percentage,
    amountOff: '',
    currency: '',
    percentageOff: '',
    cadence: CouponCadence.Once,
  }
}
