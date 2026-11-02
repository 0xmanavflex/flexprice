import {
  type BillingModel,
  type BillingPeriod,
  type CreateCharge,
  type Tier,
  type TierMode,
} from './price'
// Type only: `priceOverride` reads `BucketSize` from here at load, so a
// runtime import back would be a cycle.
import type { PriceOverride } from './priceOverride'

/**
 * Adding and editing a charge on one contract.
 *
 * A contract charge is a price (what it costs, shared with the charge editor on
 * the plan page) plus the terms only a contract has: how many, from when, and:
 * for a metered charge: the bucket usage is summed in and any commitment.
 */

export const BucketSize = {
  Minute: 'MINUTE',
  FifteenMinutes: '15MIN',
  ThirtyMinutes: '30MIN',
  Hour: 'HOUR',
  ThreeHours: '3HOUR',
  SixHours: '6HOUR',
  TwelveHours: '12HOUR',
  Day: 'DAY',
  Week: 'WEEK',
  Month: 'MONTH',
} as const
export type BucketSize = (typeof BucketSize)[keyof typeof BucketSize]

export const BUCKET_SIZE_LABEL: Record<BucketSize, string> = {
  [BucketSize.Minute]: 'Minute',
  [BucketSize.FifteenMinutes]: '15 minutes',
  [BucketSize.ThirtyMinutes]: '30 minutes',
  [BucketSize.Hour]: 'Hour',
  [BucketSize.ThreeHours]: '3 hours',
  [BucketSize.SixHours]: '6 hours',
  [BucketSize.TwelveHours]: '12 hours',
  [BucketSize.Day]: 'Day',
  [BucketSize.Week]: 'Week',
  [BucketSize.Month]: 'Month',
}

export const CommitmentKind = {
  Amount: 'amount',
  Quantity: 'quantity',
} as const
export type CommitmentKind = (typeof CommitmentKind)[keyof typeof CommitmentKind]

export const COMMITMENT_KIND_LABEL: Record<CommitmentKind, string> = {
  [CommitmentKind.Amount]: 'Spend (a money amount)',
  [CommitmentKind.Quantity]: 'Usage (a number of units)',
}

/** A minimum a customer commits to on a metered charge; usage past it is overage. */
/** One UTC window of a windowed commitment, as the line item returns it. */
export interface LineCommitmentWindow {
  id: string
  /** `HH:MM`, UTC. */
  start: string
  /** `HH:MM`, UTC. */
  end: string
  value: string
  overageFactor: string
  trueUp: boolean
  /**
   * The window's own price, when the line item included it.
   *
   * The read returns `priceId` only. Tiers stay empty until that price is
   * embedded; the id is not shown in place of them.
   */
  priceId?: string
}

export interface LineCommitment {
  kind: CommitmentKind
  /** Decimal string: money for `amount`, units for `quantity`. */
  value: string
  /** Whether the commitment applies to each bucket rather than the whole period. */
  windowed: boolean
  /** Rate multiplier on usage beyond the commitment, `1` meaning no premium. */
  overageFactor: string
  /** Bill the unused part of the commitment at the end of the period. */
  trueUp: boolean
  /** `commitment_duration`, when the line sets one instead of the billing period. */
  duration?: BillingPeriod | null
  /** `commitment_time_buckets`. Absent when the commitment covers the whole day. */
  windows?: LineCommitmentWindow[]
}

/** What a metered charge adds to its price on a contract. */
export interface UsageTerms {
  /** Empty means usage is summed over the whole period. */
  bucketSize: BucketSize | ''
  commitment: LineCommitment | null
}

export const NO_USAGE_TERMS: UsageTerms = { bucketSize: '', commitment: null }

export const PRORATION = {
  Prorate: 'create_prorations',
  None: 'none',
} as const
export type Proration = (typeof PRORATION)[keyof typeof PRORATION]

export const PRORATION_LABEL: Record<Proration, string> = {
  [PRORATION.Prorate]: 'Prorate for the rest of the period',
  [PRORATION.None]: 'Bill the full amount',
}

/** The price of one contract charge, as the line reports it back for editing. */
export interface LinePricing {
  billingModel: BillingModel
  tierMode: TierMode | null
  tiers: Tier[]
  /** Package size when `billingModel` is package, else null. */
  divideBy: number | null
  /** The custom price unit (`TOK`, `CRD`) the price is written in; empty for plain currency. */
  priceUnit: string
  /** The rate in `priceUnit` (e.g. `"10"` TOK), when the price has a custom unit and the API sent it. */
  priceUnitAmount?: string
  meterId: string
  /** Shown locked on an edit: a price's period and currency cannot change. */
  billingPeriod: BillingPeriod | null
  currency: string
  terms: UsageTerms
}

/**
 * A new charge on one contract. `startDate` is a day (`YYYY-MM-DD`, midnight
 * UTC), or an exact ISO instant when the charge starts with a contract that
 * starts later in the day; empty means now.
 */
export interface AddContractCharge {
  charge: CreateCharge
  /** Whole units, fixed charges only. */
  quantity: string
  startDate: string
  /** Fixed charges only. */
  proration: Proration
  /** Metered charges only. */
  terms: UsageTerms
}

/** A new price and terms for one metered charge. Empty `effectiveFrom` means now. */
export interface EditContractCharge {
  price: PriceOverride
  /** The line's price unit, carried so amounts go out in the right unit. */
  priceUnit: string
  effectiveFrom: string
  terms: UsageTerms
}

export interface ContractTermsErrors {
  quantity?: string
  commitmentValue?: string
  overageFactor?: string
}

const DECIMAL = /^\d+(\.\d{1,8})?$/
const WHOLE = /^[1-9]\d*$/

/** The terms only a contract has; the price itself is validated by its own schema. */
export function validateContractTerms(input: {
  /** Pass for a fixed charge, which has a quantity; omit for a metered one. */
  quantity?: string
  terms?: UsageTerms
}): ContractTermsErrors {
  const errors: ContractTermsErrors = {}
  if (input.quantity !== undefined && !WHOLE.test(input.quantity.trim()))
    errors.quantity = 'Enter a whole number of 1 or more.'

  const commitment = input.terms?.commitment
  if (commitment) {
    const value = commitment.value.trim()
    if (!DECIMAL.test(value) || Number(value) <= 0)
      errors.commitmentValue = 'Enter a commitment greater than zero.'
    else if (commitment.kind === CommitmentKind.Quantity && !WHOLE.test(value))
      errors.commitmentValue = 'Enter a whole number of units.'
    const factor = commitment.overageFactor.trim()
    if (!DECIMAL.test(factor) || Number(factor) < 1)
      errors.overageFactor = 'Enter 1 or more. 1 means no overage premium.'
  }
  return errors
}

export const hasTermsErrors = (errors: ContractTermsErrors) => Object.keys(errors).length > 0
