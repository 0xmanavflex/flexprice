import type { ListFilter, ListFilterSpec } from './listFilter'
import { z } from 'zod'
import { createCreditGrantSchema } from './creditGrant'
import {
  type AddContractCharge,
  BucketSize,
  type EditContractCharge,
  type LinePricing,
} from './contractCharge'
import { type Charge } from './price'
import { type Money } from './money'
import { BILLING_PERIOD_LABEL, BillingModel, BillingPeriod, TierMode } from './price'
import { priceOverrideSchema, type PriceOverride } from './priceOverride'

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
  /** The billing cadence as a word: "Monthly", "Half-yearly". */
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
  UpdatedAt: 'updatedAt',
  StartDate: 'startDate',
  CreatedAt: 'createdAt',
} as const
export type SubscriptionSortField =
  (typeof SubscriptionSortField)[keyof typeof SubscriptionSortField]

export const SUBSCRIPTION_SORT_LABEL: Record<SubscriptionSortField, string> = {
  [SubscriptionSortField.UpdatedAt]: 'Updated',
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
  /** Granular field filters, applied by the search endpoint. See `SUBSCRIPTION_FILTERS`. */
  filters?: ListFilter[]
}

export const DEFAULT_SUBSCRIPTION_QUERY: SubscriptionQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: SubscriptionSortField.UpdatedAt,
  sortDirection: 'desc',
  filters: [],
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
 * What the contract list can filter on: V1's fields, by their wire names.
 * Customer and plan choices are the account's own records; the page fills them
 * in with `withFilterOptions`.
 */
export const SUBSCRIPTION_FILTERS: readonly ListFilterSpec[] = [
  { field: 'customer_id', label: 'Customer', kind: 'options', options: [] },
  { field: 'plan_id', label: 'Plan', kind: 'options', options: [] },
  {
    field: 'subscription_status',
    label: 'Status',
    kind: 'options',
    options: Object.values(SubscriptionStatus).map((value) => ({
      value,
      label: SUBSCRIPTION_STATUS_LABEL[value],
    })),
  },
  {
    field: 'billing_period',
    label: 'Billing period',
    kind: 'options',
    options: SUBSCRIPTION_BILLING_PERIODS.map((value) => ({
      value,
      label: BILLING_PERIOD_LABEL[value],
    })),
  },
  { field: 'start_date', label: 'Start date', kind: 'date' },
  { field: 'created_at', label: 'Created', kind: 'date' },
]

const PHASE_DECIMAL = /^\d+(\.\d+)?$/

const CONTRACT_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A contract date: a day (`YYYY-MM-DD`) or, picked with a time, an instant (an
 * ISO string). Blank is allowed where the field is optional.
 */
const optionalContractDate = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || CONTRACT_DAY.test(value) || !Number.isNaN(Date.parse(value)),
    'Pick a date',
  )

/**
 * A contract date as the API takes it: a day is midnight UTC (as every
 * date-only field has always been sent), an instant is itself.
 */
export function contractDateToInstant(value: string): Date {
  return CONTRACT_DAY.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value)
}

/** A contract date's position in time, for ordering: a day is its local midnight. */
function contractMoment(value: string): number {
  if (CONTRACT_DAY.test(value)) {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number]
    return new Date(y, m - 1, d).getTime()
  }
  return Date.parse(value)
}

/** The local day a contract date falls on, `YYYY-MM-DD`. */
export function contractDay(value: string): string {
  if (CONTRACT_DAY.test(value)) return value
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A decimal amount, or blank for none. */
const optionalAmount = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || PHASE_DECIMAL.test(value), message)

/**
 * A discount on a phase: a coupon on the whole phase, or: with `priceId`: on
 * one of its charges. Sent by coupon id, as V1 does, since a coupon need not
 * carry a redemption code.
 */
export const subscriptionDiscountSchema = z.object({
  couponId: z.string().min(1, 'Choose a coupon'),
  /** Absent: the whole phase. Set: only this charge. */
  priceId: z.string().optional(),
})
export type SubscriptionDiscount = z.infer<typeof subscriptionDiscountSchema>

/**
 * One phase of a contract: a stretch of time with its own charges and
 * discounts. The first phase is the contract itself; each later phase starts
 * where the one before it ends, so only end dates are chosen. The last phase's
 * end is the contract's end, and blank means it runs until cancelled.
 */
export const subscriptionPhaseSchema = z.object({
  /** `YYYY-MM-DD`; blank on the last phase means open-ended. */
  endDate: optionalContractDate,
  /** The plan's charges, repriced for this phase. */
  priceOverrides: z.array(priceOverrideSchema),
  /** Fixed charges billed at another quantity in this phase, e.g. 25 seats. */
  quantities: z.array(
    z.object({
      priceId: z.string().min(1),
      quantity: z
        .string()
        .trim()
        .refine(
          (value) => /^\d+(\.\d+)?$/.test(value) && Number(value) > 0,
          'Enter a quantity above zero',
        ),
    }),
  ),
  discounts: z.array(subscriptionDiscountSchema),
  /**
   * Charges for this contract (or this phase) alone, beyond the plan's: each
   * already checked by the add-charge form it came from.
   */
  extraCharges: z.array(z.custom<AddContractCharge>()),
})
export type SubscriptionPhase = z.infer<typeof subscriptionPhaseSchema>

export const CommitmentType = { Amount: 'amount', Quantity: 'quantity' } as const
export type CommitmentType = (typeof CommitmentType)[keyof typeof CommitmentType]

const COMMITMENT_DECIMAL = /^\d+(\.\d{1,8})?$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/** A blank overage factor reads as 1, the normal rate. */
const overageFactorSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (COMMITMENT_DECIMAL.test(value) && Number(value) >= 1),
    'Enter 1 or more. 1 means no overage premium.',
  )

/** How usage inside a time window is billed. */
export const WindowBillingModel = {
  PerUnit: BillingModel.FlatFee,
  Package: BillingModel.Package,
} as const
export type WindowBillingModel = (typeof WindowBillingModel)[keyof typeof WindowBillingModel]

export const WINDOW_BILLING_MODEL_LABEL: Record<WindowBillingModel, string> = {
  [WindowBillingModel.PerUnit]: 'Per unit',
  [WindowBillingModel.Package]: 'Package',
}

/**
 * One UTC window of the day with its own commitment and price
 * (`commitment_time_buckets`): start inclusive, end exclusive.
 */
export const commitmentWindowSchema = z
  .object({
    id: z.string(),
    /** `HH:MM`, UTC. */
    start: z.string().regex(CLOCK, 'Pick a time'),
    /** `HH:MM`, UTC. */
    end: z.string().regex(CLOCK, 'Pick a time'),
    type: z.enum([CommitmentType.Amount, CommitmentType.Quantity]),
    value: z
      .string()
      .trim()
      .min(1, 'This field is required')
      .refine(
        (value) => COMMITMENT_DECIMAL.test(value) && Number(value) > 0,
        'Enter a commitment greater than zero.',
      ),
    overageFactor: overageFactorSchema,
    trueUp: z.boolean(),
    billingModel: z.enum([WindowBillingModel.PerUnit, WindowBillingModel.Package]),
    price: z
      .string()
      .trim()
      .refine(
        (value) => COMMITMENT_DECIMAL.test(value) && Number(value) > 0,
        'Enter a price for this window',
      ),
    /** Units per package, for a package price. */
    packageSize: z.string().trim(),
  })
  .superRefine((window, ctx) => {
    if (window.start === window.end)
      ctx.addIssue({
        code: 'custom',
        path: ['start'],
        message: 'Start and end time cannot be the same',
      })
    if (
      window.billingModel === WindowBillingModel.Package &&
      !/^[1-9]\d*$/.test(window.packageSize)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['packageSize'],
        message: 'Enter a whole number of 1 or more.',
      })
  })
export type CommitmentWindow = z.infer<typeof commitmentWindowSchema>

/**
 * What a window's own price is built on: the plan charge it reprices, so the
 * window bills the same meter, currency and period.
 */
export const commitmentPriceBaseSchema = z.object({
  entityId: z.string(),
  entityType: z.string(),
  meterId: z.string(),
  currency: z.string(),
  billingPeriod: z.string(),
  billingPeriodCount: z.number(),
  invoiceCadence: z.string(),
})
export type CommitmentPriceBase = z.infer<typeof commitmentPriceBaseSchema>

/** A minimum on one usage charge: spend (amount) or units (quantity) per period. */
export const chargeCommitmentSchema = z
  .object({
    priceId: z.string().min(1),
    type: z.enum([CommitmentType.Amount, CommitmentType.Quantity]),
    value: z
      .string()
      .trim()
      .refine(
        (value) => COMMITMENT_DECIMAL.test(value) && Number(value) > 0,
        'Enter a commitment greater than zero.',
      ),
    /** The period the commitment is measured over; blank is the billing period. */
    duration: z.union([z.literal(''), z.enum(BillingPeriod)]),
    /** Multiplier on usage beyond the commitment; blank is 1, the base rate. */
    overageFactor: overageFactorSchema,
    /** Bill the shortfall when usage stays under the commitment. */
    trueUp: z.boolean(),
    /**
     * The bucket usage is summed in before it is priced; blank keeps the plan
     * charge's own. Sent as the charge's `bucket_size` override.
     */
    bucketSize: z.union([z.literal(''), z.enum(BucketSize)]),
    /** Apply the commitment to every bucket, not the whole period. Needs a bucket size. */
    windowed: z.boolean(),
    /** Optional UTC windows of the day, each with its own commitment and price. */
    windows: z.array(commitmentWindowSchema),
    /** The plan charge a window's price is built on; set when the charge is known. */
    priceBase: commitmentPriceBaseSchema.optional(),
  })
  .superRefine((commitment, ctx) => {
    if (commitment.windowed && !commitment.bucketSize)
      ctx.addIssue({
        code: 'custom',
        path: ['windowed'],
        message: 'Set a bucket size above first.',
      })
  })
export type ChargeCommitment = z.infer<typeof chargeCommitmentSchema>

export const PaymentTerms = {
  Net15: '15 NET',
  Net30: '30 NET',
  Net45: '45 NET',
  Net60: '60 NET',
  Net75: '75 NET',
  Net90: '90 NET',
  EndOfMonth: 'END_OF_MONTH',
  EndOfNextMonth: 'END_OF_NEXT_MONTH',
} as const
export type PaymentTerms = (typeof PaymentTerms)[keyof typeof PaymentTerms]

export const PAYMENT_TERMS_LABEL: Record<PaymentTerms, string> = {
  [PaymentTerms.Net15]: 'Net 15',
  [PaymentTerms.Net30]: 'Net 30',
  [PaymentTerms.Net45]: 'Net 45',
  [PaymentTerms.Net60]: 'Net 60',
  [PaymentTerms.Net75]: 'Net 75',
  [PaymentTerms.Net90]: 'Net 90',
  [PaymentTerms.EndOfMonth]: 'End of month',
  [PaymentTerms.EndOfNextMonth]: 'End of next month',
}

export const BillingCycle = { Anniversary: 'anniversary', Calendar: 'calendar' } as const
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle]

export const INHERITANCE_WITH_BILLING_CUSTOMER =
  "Inherited customers are billed to this contract's customer. Set the billing customer to Same customer, or remove the inherited customers."
export const INHERITANCE_WITH_THRESHOLD =
  'An auto-invoice threshold cannot be used on a contract with inherited customers. Clear it, or remove the inherited customers.'

/**
 * Why a customer cannot inherit a contract, as the API decides it:
 * - `OwnContract`: it has a contract of its own (active, trialing or draft)
 *   that is not under the paying customer.
 * - `OtherParent`: it already inherits, or is grouped under, another
 *   customer's contract.
 */
export const InheritanceBlock = {
  OwnContract: 'own-contract',
  OtherParent: 'other-parent',
} as const
export type InheritanceBlock = (typeof InheritanceBlock)[keyof typeof InheritanceBlock]

export const INHERITANCE_BLOCK_LABEL: Record<InheritanceBlock, string> = {
  [InheritanceBlock.OwnContract]: 'Has its own contract',
  [InheritanceBlock.OtherParent]: "Inherits another customer's contract",
}

/**
 * The rules for starting a contract, in the order the form asks them: V1's:
 * customer and plan with the contract's dates; phases, each with its own
 * charges then discounts; commitments (on the contract and on usage charges);
 * entitlement overrides and credit grants; taxes; add-ons; and the billing
 * configuration last.
 */
export const createSubscriptionSchema = z
  .object({
    customerId: z.string().min(1, 'Choose a customer'),
    planId: z.string().min(1, 'Choose a plan'),
    currency: z.string().trim().min(3, 'Choose a currency').max(3, 'Choose a currency'),
    billingPeriod: z.enum(SUBSCRIPTION_BILLING_PERIODS, { error: 'Choose a billing period' }),
    billingPeriodCount: z
      .number({ error: 'Enter a number' })
      .int('Must be a whole number')
      .positive('Must be greater than zero'),
    /** `YYYY-MM-DD`, or empty to start now. */
    startDate: optionalContractDate,
    trialPeriodDays: z
      .number({ error: 'Enter a number' })
      .int('Must be a whole number')
      .nonnegative('Cannot be negative')
      .optional(),
    /** At least one: the first phase is the contract itself. */
    phases: z.array(subscriptionPhaseSchema).min(1),
    /** Plan charges at another cadence the person chose to bill too (see `selectContractCharges`). */
    optedInChargeIds: z.array(z.string()),
    /**
     * `include_price_ids`, worked out from the plan's charges when the form is
     * submitted: null keeps the API's default selection.
     */
    includePriceIds: z.array(z.string()).nullable(),
    /** A minimum spend on the whole contract per commitment period; blank for none. */
    commitmentAmount: optionalAmount('Enter an amount like 1000'),
    /** The period the commitment is measured over; blank is the billing period. */
    commitmentDuration: z.enum(['', ...SUBSCRIPTION_BILLING_PERIODS]),
    overageFactor: optionalAmount('Enter a factor like 1.2').refine(
      (value) => value === '' || Number(value) >= 1,
      'Overage factor must be at least 1.0',
    ),
    enableTrueUp: z.boolean(),
    chargeCommitments: z.array(chargeCommitmentSchema),
    entitlementOverrides: z.array(
      z.object({
        entitlementId: z.string().min(1),
        /** Metered: the allowance for this customer; omitted keeps the plan's. */
        usageLimit: z.number().int().nonnegative('Cannot be negative').optional(),
        /** Boolean: whether the feature is on; omitted keeps the plan's. */
        isEnabled: z.boolean().optional(),
      }),
    ),
    /**
     * The contract's credit grants. Opens as the plan's; once changed, this whole
     * list is sent and replaces the plan's on this contract (the API's rule).
     */
    creditGrants: z.array(createCreditGrantSchema),
    /** Whether the grants differ from the plan's, and so must be sent. */
    creditGrantsChanged: z.boolean(),
    /** Tax rates applied to the contract's invoices: prefilled from the customer, as V1 does. */
    taxes: z.array(
      z.object({
        taxRateCode: z.string().min(1),
        name: z.string(),
        percentage: z.string(),
        taxBehavior: z.enum(['exclusive', 'inclusive']),
        priority: z.number().int(),
        autoApply: z.boolean(),
      }),
    ),
    // Each add-on may commit on its own usage charges, as V1's add-on card.
    addons: z.array(
      z.object({
        addonId: z.string().min(1),
        name: z.string(),
        commitments: z.array(chargeCommitmentSchema).optional(),
      }),
    ),
    // Billing configuration.
    billingCycle: z.enum([BillingCycle.Anniversary, BillingCycle.Calendar]),
    /** `YYYY-MM-DD`: the day cycles are anchored to; blank follows the start date. */
    billingAnchor: optionalContractDate,
    paymentTerms: z.enum([
      '',
      PaymentTerms.Net15,
      PaymentTerms.Net30,
      PaymentTerms.Net45,
      PaymentTerms.Net60,
      PaymentTerms.Net75,
      PaymentTerms.Net90,
      PaymentTerms.EndOfMonth,
      PaymentTerms.EndOfNextMonth,
    ]),
    /** Charge or credit the part of a period a change falls in. */
    prorate: z.boolean(),
    /** Invoice early once unbilled usage reaches this amount; blank for never. */
    autoInvoiceThreshold: optionalAmount('Enter an amount like 500'),
    /** Create as a draft to activate later, rather than starting it. */
    draft: z.boolean(),
    /**
     * Who pays: another customer's external id to send this contract's
     * invoices to (`inheritance.invoicing_customer_external_id`), or empty for
     * the contract's own customer.
     */
    invoicingCustomerExternalId: z.string(),
    /**
     * Child customers (external ids) that inherit this contract
     * (`inheritance.external_customer_ids_to_inherit_subscription`).
     */
    inheritedCustomerExternalIds: z.array(z.string().min(1)),
  })
  .superRefine((value, ctx) => {
    // Each phase but the last needs an end, and every end follows its start.
    // A contract with no start date starts today, so the first end must follow today.
    let start = value.startDate || localToday()
    value.phases.forEach((phase, index) => {
      const last = index === value.phases.length - 1
      if (!last && !phase.endDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'endDate'],
          message: 'Choose when this phase ends',
        })
      }
      if (phase.endDate && start && contractMoment(phase.endDate) <= contractMoment(start)) {
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'endDate'],
          message:
            index === 0 ? 'The end has to come after the start' : 'The end must be after the start',
        })
      }
      start = phase.endDate || start
    })
    // A contract in phases is a schedule, and a schedule needs a fixed first
    // day: "today" would move every phase boundary with the day it is saved.
    if (value.phases.length > 1 && !value.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'Choose when the contract starts: a contract in phases needs a start date',
      })
    }
    // The API refuses entitlement overrides on a prorated contract (V1 checks
    // it before sending, with the same words).
    if (value.prorate && value.entitlementOverrides.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['prorate'],
        message:
          'Entitlement overrides cannot be combined with proration. Turn off proration or remove the entitlement overrides.',
      })
    }
    // A chosen billing date counts periods from that day, so it cannot come
    // before the contract has started.
    const contractStart = value.startDate || localToday()
    // Compared by day: a billing date on the start day is fine whatever the time.
    if (value.billingAnchor && contractDay(value.billingAnchor) < contractDay(contractStart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['billingAnchor'],
        message: value.startDate
          ? 'Choose a date on or after the contract start date'
          : 'The contract starts today, so choose today or a later date',
      })
    }
    // Customers that inherit a contract are billed through its own customer, so
    // the API takes either inherited customers or another billing customer,
    // never both, and an early invoice threshold only on a contract without them.
    if (value.inheritedCustomerExternalIds.length > 0) {
      if (value.invoicingCustomerExternalId) {
        ctx.addIssue({
          code: 'custom',
          path: ['inheritedCustomerExternalIds'],
          message: INHERITANCE_WITH_BILLING_CUSTOMER,
        })
      }
      if (value.autoInvoiceThreshold) {
        ctx.addIssue({
          code: 'custom',
          path: ['autoInvoiceThreshold'],
          message: INHERITANCE_WITH_THRESHOLD,
        })
      }
    }
  })

export type CreateSubscription = z.infer<typeof createSubscriptionSchema>

/** Today as a local `YYYY-MM-DD`, the form dates are picked in. */
function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A blank phase: the plan's charges as they are, no discounts, open-ended. */
export function emptyPhase(): SubscriptionPhase {
  return { endDate: '', priceOverrides: [], quantities: [], discounts: [], extraCharges: [] }
}

/**
 * Where each phase starts: the first at the contract's start (blank = now), each
 * later one where the phase before it ends.
 */
export function phaseStarts(draft: Pick<CreateSubscription, 'startDate' | 'phases'>): string[] {
  return draft.phases.map((_, index) =>
    index === 0 ? draft.startDate : (draft.phases[index - 1]?.endDate ?? ''),
  )
}

export function emptySubscription(): CreateSubscription {
  return {
    customerId: '',
    planId: '',
    currency: '',
    billingPeriod: BillingPeriod.Monthly as CreateSubscription['billingPeriod'],
    billingPeriodCount: 1,
    startDate: '',
    phases: [emptyPhase()],
    optedInChargeIds: [],
    includePriceIds: null,
    commitmentAmount: '',
    commitmentDuration: '',
    overageFactor: '',
    enableTrueUp: false,
    chargeCommitments: [],
    entitlementOverrides: [],
    creditGrants: [],
    creditGrantsChanged: false,
    taxes: [],
    addons: [],
    billingCycle: BillingCycle.Anniversary,
    billingAnchor: '',
    paymentTerms: '',
    // Off until someone turns it on in Dates and billing.
    prorate: false,
    autoInvoiceThreshold: '',
    draft: false,
    invoicingCustomerExternalId: '',
    inheritedCustomerExternalIds: [],
  }
}

/**
 * The contract-level commitment: a minimum spend per commitment period, set
 * when the contract is created. It is separate from the commitments a usage
 * charge carries, and the API has no way to change it afterwards.
 */
export interface ContractCommitment {
  /** The minimum spend per commitment period. */
  amount: Money
  /** The period the minimum is measured over. */
  period: BillingPeriod
  /** How many of that period, when the contract bills every few months. */
  periodCount: number
  /** Multiplier on spend beyond the minimum; 1 is the normal rate. */
  overageFactor: number
  /** Bill the shortfall when spend stays under the minimum. */
  trueUp: boolean
}

const COMMITMENT_PERIOD_NOUN: Record<BillingPeriod, [one: string, many: string]> = {
  [BillingPeriod.Daily]: ['day', 'days'],
  [BillingPeriod.Weekly]: ['week', 'weeks'],
  [BillingPeriod.Monthly]: ['month', 'months'],
  [BillingPeriod.Quarterly]: ['quarter', 'quarters'],
  [BillingPeriod.HalfYearly]: ['half-year', 'half-years'],
  [BillingPeriod.Annual]: ['year', 'years'],
  [BillingPeriod.OneTime]: ['contract', 'contracts'],
}

/**
 * The commitment period as "month", "year", "2 weeks": what follows "per".
 * Twelve months reads as a year, as the old console wrote it.
 */
export function commitmentPeriodNoun(period: BillingPeriod, count = 1): string {
  if (period === BillingPeriod.Monthly && count === 12) return 'year'
  const [one, many] = COMMITMENT_PERIOD_NOUN[period]
  return count > 1 ? `${count} ${many}` : one
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
  /** The minimum spend the contract commits to; null when it has none. */
  commitment: ContractCommitment | null
  /** The most recent invoice, as a link target. */
  latestInvoice: { id: string; number: string } | null
  /**
   * Where the contract sits in a customer hierarchy, lower case: standalone,
   * parent, inherited (a mirror of its parent's, with no lines of its own),
   * delegated_invoicing or grouped_invoicing. Empty when the API did not say.
   */
  subscriptionType: string
  /** The contract this one hangs from; null for a top-level contract. */
  parentSubscriptionId: string | null
  /** The customer invoiced for this contract when it is not its own customer. */
  invoicingCustomerId: string | null
}

/** An inherited contract mirrors its parent's: it has no lines of its own and is read-only. */
export function isInheritedContract(contract: Pick<SubscriptionDetail, 'subscriptionType'>): boolean {
  return contract.subscriptionType === 'inherited'
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

/** One billed line on a subscription: a fixed charge or a metered one. */
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
  /** The price as the shared charges table reads it; null when the line has none. */
  charge: Charge | null
  /**
   * The plan price this line overrides (`parent_price_id`), or empty.
   *
   * Set only when the contract changed the price, which is what the charges
   * table's "Price changed" flag reports. It is an id, not an amount: knowing
   * *that* it changed needs no second request, knowing *from what* does.
   */
  overridesPriceId: string
}

export type SubscriptionLineSource = 'plan' | 'addon' | 'contract'

/** One charge on a contract across its versions. */
export interface LineLineage {
  /** The version that bills now, or the last one when the charge has ended. */
  current: SubscriptionLine
  /** Every version, newest first; `current` is the first. */
  versions: SubscriptionLine[]
}

/**
 * A contract's lines grouped into the charges they are versions of.
 *
 * Changing a charge's price on a contract never edits it in place: the API ends
 * the line (its `end_date`) and starts a new one whose price points back to the
 * one it replaced (`parent_price_id`). Linking those ids end to end turns the
 * ended lines back into what they are: earlier versions of one charge, kept
 * inactive, not deleted: so the table shows each charge once and its history
 * lists every price it has had.
 */
export function lineLineages(lines: readonly SubscriptionLine[]): LineLineage[] {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string
    parent.set(id, root)
    return root
  }
  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent.set(rootA, rootB)
  }
  const keyOf = (line: SubscriptionLine) => line.priceId || `line:${line.id}`

  for (const line of lines) {
    find(keyOf(line))
    if (line.overridesPriceId) union(keyOf(line), line.overridesPriceId)
  }

  const groups = new Map<string, SubscriptionLine[]>()
  for (const line of lines) {
    const root = find(keyOf(line))
    groups.set(root, [...(groups.get(root) ?? []), line])
  }

  // Newest first: a later start wins; at the same start, the open-ended line.
  const newestFirst = (a: SubscriptionLine, b: SubscriptionLine) =>
    (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0) ||
    (a.endDate ? 1 : 0) - (b.endDate ? 1 : 0)

  return [...groups.values()].map((group) => {
    const versions = [...group].sort(newestFirst)
    return { current: versions[0] as SubscriptionLine, versions }
  })
}

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

export const SUBSCRIPTION_CANCELLATION_TYPES = [
  'immediate',
  'end_of_period',
  'scheduled_date',
] as const
export type SubscriptionCancellationType = (typeof SUBSCRIPTION_CANCELLATION_TYPES)[number]

export interface CancelSubscription {
  cancellationType: SubscriptionCancellationType
  reason: string
  /** For `scheduled_date`: the day (`YYYY-MM-DD`) the contract ends. */
  cancelAt?: string
  /** Credit or charge the unused or extra part of the period. Absent means none. */
  prorate?: boolean
  /** For `immediate`: raise a final invoice now, rather than skip it. */
  generateInvoice?: boolean
}

/**
 * Pausing a contract: `POST /subscriptions/{id}/pause`, as V1 sends it: a
 * proration choice and an optional reason. Billing stops until it is resumed.
 */
export interface PauseSubscription {
  /** Credit the unused part of the current period. Off means no proration. */
  prorate: boolean
  reason: string
}

/** Resuming a paused contract: `POST /subscriptions/{id}/resume`. */
export interface ResumeSubscription {
  /** Charge for the remainder of the current period. Off means no proration. */
  prorate: boolean
}

/** Pause is offered on a running contract; resume only on a paused one. */
export function canPauseSubscription(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.Active || status === SubscriptionStatus.Trialing
}

export function canResumeSubscription(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.Paused
}

/** One line of the invoice a contract will raise next. */
export interface InvoicePreviewLine {
  id: string
  /** The price that produced this line: joins it to the contract's line for its real price. */
  priceId: string
  name: string
  /** The period note under the name, when the API sent one. */
  detail: string
  quantity: string
  /** The amount over the quantity (exact; `perUnit`), or null without a quantity. */
  unitPrice: Money | null
  amount: Money
  kind: 'fixed' | 'usage' | null
}

/**
 * The invoice a contract would raise for its current period, as the API
 * computes it. Every figure is the API's; nothing here is summed.
 */
export interface InvoicePreview {
  periodStart: Date | null
  periodEnd: Date | null
  lines: InvoicePreviewLine[]
  subtotal: Money
  discount: Money
  tax: Money
  prepaidCredits: Money
  amountDue: Money
}

/** An add-on attached to a contract. */
export interface SubscriptionAddon {
  id: string
  name: string
  active: boolean
  startDate: Date | null
  endDate: Date | null
}

/** A coupon applied to a contract. */
export interface SubscriptionCoupon {
  /** Only this line receives the discount; absent means contract/phase scope. */
  lineItemId?: string | undefined
  id: string
  name: string
  code: string
  /** The discount in words: "10% off" or "$20.00 off". */
  discount: string
  active: boolean
  startDate: Date | null
  endDate: Date | null
}

/** A tax rate applied to a contract. */
export interface SubscriptionTax {
  id: string
  name: string
  code: string
  /** The rate as the API sends it, or empty. */
  percentage: string
  inclusive: boolean
  priority: number
}

/** Attach an add-on to one contract, with commitments on its usage charges. */
export interface AddContractAddon {
  addonId: string
  commitments?: ChargeCommitment[]
}

/** Apply a coupon to one contract, or replace the coupons on one of its charges. */
export interface AddContractCoupon {
  couponCode: string
  /**
   * Apply to this charge only.
   *
   * The modify API treats a line and the whole contract as mutually exclusive
   * scopes, so a line coupon never also sends the contract id.
   */
  lineItemId?: string
  /**
   * Associations removed after the new one is added.
   *
   * A charge's Edit replaces its current coupons. The new one is added first,
   * so a rejected add leaves the existing coupons in place.
   */
  replaceAssociationIds?: string[]
}

/**
 * The edit that brings a contract charge back to an earlier version: the old
 * line's price and terms, sent against the current line. The API has no
 * revert; this starts a new version, from now, priced as the old one was, so
 * the current price is kept as history too. Null when the old line's pricing
 * was not reported, as there is then nothing exact to send.
 */
export function lineRevertDraft(
  previous: SubscriptionLine,
  currentPriceId: string,
): EditContractCharge | null {
  const pricing = previous.pricing
  if (!pricing) return null
  const amount = previous.amount.amount || '0'
  const price: PriceOverride =
    pricing.billingModel === BillingModel.Package
      ? {
          priceId: currentPriceId,
          billingModel: BillingModel.Package,
          amount,
          divideBy: pricing.divideBy ?? 1,
        }
      : pricing.billingModel === BillingModel.Tiered
        ? {
            priceId: currentPriceId,
            billingModel: BillingModel.Tiered,
            tierMode: pricing.tierMode ?? TierMode.Volume,
            tiers: pricing.tiers,
          }
        : { priceId: currentPriceId, billingModel: BillingModel.FlatFee, amount }
  return { price, priceUnit: pricing.priceUnit, effectiveFrom: '', terms: pricing.terms }
}
