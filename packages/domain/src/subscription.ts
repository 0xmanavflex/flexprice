import { z } from 'zod'
import { createCreditGrantSchema } from './creditGrant'
import { BillingPeriod } from './price'
import { priceOverrideSchema } from './priceOverride'

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
  /**
   * The cycle currently being billed.
   *
   * Both ends, because half a period is not a period: the list's "Current
   * period" column needs a range, and `currentPeriodEnd` alone can only be
   * labelled "Renews". The API has carried `current_period_start` all along
   * (`SubscriptionResponse.currentPeriodStart`); the read model simply was not
   * asking for it.
   */
  currentPeriodStart: Date | null
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

/**
 * The cadences a subscription can bill on. One-time is a price's shape, not a
 * subscription's, so it is not offered here.
 */
export const SUBSCRIPTION_BILLING_PERIODS = [
  BillingPeriod.Daily,
  BillingPeriod.Weekly,
  BillingPeriod.Monthly,
  BillingPeriod.Quarterly,
  BillingPeriod.HalfYearly,
  BillingPeriod.Annual,
] as const

/**
 * The rules for starting a subscription.
 *
 * Six steps, one draft: who (`customerId`), what (`planId`, with the currency
 * and period it bills in), the price overrides for this customer alone, the
 * entitlement overrides, the credit grants, and — on review — nothing new. The
 * overrides and grants are lists because a subscription carries any number of
 * them, including none, and an empty list is the common case.
 */
export const createSubscriptionSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer'),
  planId: z.string().min(1, 'Choose a plan'),
  currency: z.string().trim().min(3, 'Choose a currency').max(3, 'Choose a currency'),
  billingPeriod: z.enum(SUBSCRIPTION_BILLING_PERIODS, { error: 'Choose a billing period' }),
  billingPeriodCount: z
    .number({ error: 'Enter a number' })
    .int('Must be a whole number')
    .positive('Must be greater than zero'),
  /** `YYYY-MM-DD`, or empty to start now. */
  startDate: z.string(),
  trialPeriodDays: z
    .number({ error: 'Enter a number' })
    .int('Must be a whole number')
    .nonnegative('Cannot be negative')
    .optional(),
  priceOverrides: z.array(priceOverrideSchema),
  entitlementOverrides: z.array(
    z.object({
      entitlementId: z.string().min(1),
      /** Metered: the allowance for this customer; omitted keeps the plan's. */
      usageLimit: z.number().int().nonnegative('Cannot be negative').optional(),
      /** Boolean: whether the feature is on; omitted keeps the plan's. */
      isEnabled: z.boolean().optional(),
    }),
  ),
  creditGrants: z.array(createCreditGrantSchema),
})

export type CreateSubscription = z.infer<typeof createSubscriptionSchema>

export function emptySubscription(): CreateSubscription {
  return {
    customerId: '',
    planId: '',
    currency: '',
    billingPeriod: BillingPeriod.Monthly as CreateSubscription['billingPeriod'],
    billingPeriodCount: 1,
    startDate: '',
    priceOverrides: [],
    entitlementOverrides: [],
    creditGrants: [],
  }
}
