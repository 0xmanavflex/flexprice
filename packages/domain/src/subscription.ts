import { z } from 'zod'
import { createCreditGrantSchema } from './creditGrant'
import { type LinePricing } from './contractCharge'
import { type Money } from './money'
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

/** The detail read model: the list row plus what the detail page adds. */
export interface SubscriptionDetail extends Subscription {
  /** The API's billing period, which a new charge on this contract must match. */
  billingPeriod: BillingPeriod | null
  billingPeriodCount: number
  cancelAt: Date | null
  cancelAtPeriodEnd: boolean
  cancelledAt: Date | null
  endDate: Date | null
  trialEnd: Date | null
  paymentTerms: string
  collectionMethod: string
  metadata: Record<string, string>
  trialStart: Date | null
  timezone: string
  /** The caller's own key for this contract, when it set one. */
  lookupKey: string
  /** The minimum spend the contract commits to per period; null when it has none. */
  commitmentAmount: Money | null
  /** The most recent invoice, as a link target. */
  latestInvoice: { id: string; number: string } | null
}

/** One metered charge in the current period's usage. */
export interface SubscriptionUsageCharge {
  id: string
  name: string
  /** Units consumed this period. */
  quantity: number
  amount: Money
  isOverage: boolean
}

/** What the subscription has consumed and cost so far this period. */
export interface SubscriptionUsage {
  periodStart: Date | null
  periodEnd: Date | null
  total: Money
  commitment: Money | null
  commitmentUtilized: Money | null
  overage: Money | null
  hasOverage: boolean
  charges: SubscriptionUsageCharge[]
}

export const SubscriptionScheduleType = {
  PlanChange: 'plan_change',
  Cancellation: 'cancellation',
} as const
export type SubscriptionScheduleType =
  (typeof SubscriptionScheduleType)[keyof typeof SubscriptionScheduleType]

export const SUBSCRIPTION_SCHEDULE_LABEL: Record<SubscriptionScheduleType, string> = {
  [SubscriptionScheduleType.PlanChange]: 'Plan change',
  [SubscriptionScheduleType.Cancellation]: 'Cancellation',
}

/** A change queued for a future date, such as a plan change or a cancellation. */
export interface SubscriptionSchedule {
  id: string
  type: SubscriptionScheduleType
  scheduledAt: Date | null
  daysUntilExecution: number | null
  canBeCancelled: boolean
}

/** One billed line on a subscription — a fixed charge or a metered one. */
export interface SubscriptionLine {
  id: string
  name: string
  kind: 'fixed' | 'usage'
  quantity: string
  billingPeriodLabel: string
  /** The unit price as the API sent it; formatted by the screen. */
  amount: Money
  startDate: Date | null
  endDate: Date | null
  /** Where the charge comes from: the plan (shared by every contract on it), an add-on, or this contract alone. */
  source: SubscriptionLineSource
  priceId: string
  /** Only a flat-fee price in a real currency can be repriced through a quantity change. */
  amountEditable: boolean
  /** How the price is built, for editing a metered charge; null when the API did not say. */
  pricing: LinePricing | null
}

export type SubscriptionLineSource = 'plan' | 'addon' | 'contract'

/** End a charge. `effectiveFrom` empty means now. */
export interface EndContractCharge {
  effectiveFrom: string
}

/**
 * A quantity and/or flat-fee price change on one fixed charge. Empty strings
 * mean "unchanged"; an empty `effectiveDate` means now.
 */
export interface ChangeLineQuantity {
  quantity: string
  amount: string
  effectiveDate: string
}

/** What a quantity change would do, as the API previews it before anything is saved. */
export interface LineChangePreview {
  lines: {
    id: string
    action: string
    quantity: string
    startDate: Date | null
    endDate: Date | null
  }[]
  invoices: { action: string; status: string; amountDue: Money | null }[]
}

export interface LineChangeError {
  quantity?: string
  amount?: string
  effectiveDate?: string
  form?: string
}

const DECIMAL = /^\d+(\.\d{1,8})?$/

/**
 * The rules the API enforces, checked up front so the dialog can say what is
 * wrong without a round trip: a non-negative quantity and price, at least one
 * real change, and an effective date inside the current period and the line's
 * own window (the end is exclusive).
 */
export function validateLineChange(
  line: Pick<SubscriptionLine, 'quantity' | 'amount' | 'startDate' | 'endDate' | 'amountEditable'>,
  draft: ChangeLineQuantity,
  period: { start: Date | null; end: Date | null },
): LineChangeError {
  const errors: LineChangeError = {}
  const quantity = draft.quantity.trim()
  const amount = draft.amount.trim()
  const quantityChanged = quantity !== '' && Number(quantity) !== Number(line.quantity)
  const amountChanged =
    line.amountEditable && amount !== '' && Number(amount) !== Number(line.amount.amount)

  if (quantity !== '' && !DECIMAL.test(quantity)) errors.quantity = 'Enter a quantity of 0 or more.'
  if (amount !== '' && !DECIMAL.test(amount)) errors.amount = 'Enter a price of 0 or more.'

  if (draft.effectiveDate) {
    const at = new Date(`${draft.effectiveDate}T00:00:00Z`)
    const lower = [line.startDate, period.start].filter((d): d is Date => d !== null)
    const earliest = lower.length ? new Date(Math.max(...lower.map((d) => d.getTime()))) : null
    const latest = [line.endDate, period.end].filter((d): d is Date => d !== null)
    const last = latest.length ? new Date(Math.min(...latest.map((d) => d.getTime()))) : null
    if (earliest && at < earliest)
      errors.effectiveDate = 'Pick a date inside the current billing period.'
    else if (last && at >= last) errors.effectiveDate = 'Pick a date before this period ends.'
  }

  if (!errors.quantity && !errors.amount && !quantityChanged && !amountChanged) {
    errors.form =
      'Change the quantity' + (line.amountEditable ? ' or the price' : '') + ' to continue.'
  }
  return errors
}

/** One feature the subscription entitles the customer to. */
export interface SubscriptionEntitlement {
  featureId: string
  name: string
  enabled: boolean
  /** `null` is unlimited. */
  usageLimit: number | null
  softLimit: boolean
  resetPeriodLabel: string
}

export const SUBSCRIPTION_CANCELLATION_TYPES = ['immediate', 'end_of_period'] as const
export type SubscriptionCancellationType = (typeof SUBSCRIPTION_CANCELLATION_TYPES)[number]

export interface CancelSubscription {
  cancellationType: SubscriptionCancellationType
  reason: string
}
