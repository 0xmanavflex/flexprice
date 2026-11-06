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
  kind?: CommitmentKind

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
 * starts later in the day; empty means now (see `startingNow`).
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

/**
 * A charge added to a running contract with "Now" (empty) or today picked, as
 * the exact instant now.
 *
 * The API reads a missing start as the contract's current period start, so an
 * empty start backdated the charge by hours (QA #66); today as midnight UTC is
 * earlier still, or yesterday west of UTC. Any other day, or an instant already
 * chosen (a charge starting with a contract that starts later), is left as is.
 */
export function startingNow(draft: AddContractCharge, now: Date = new Date()): AddContractCharge {
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return draft.startDate === '' || draft.startDate === today
    ? { ...draft, startDate: now.toISOString() }
    : draft
}

/** A new price and terms for one metered charge. Empty `effectiveFrom` means now. */
export interface EditContractCharge {
  subscriptionId?: string
  /** The line had a commitment and this edit removes it. */
  clearCommitment?: boolean

  /** A new time window starts at the edited charge’s own price. Existing window IDs retain theirs. */
  windowPrice?: CreateCharge

  price: PriceOverride
  /** The line's price unit, carried so amounts go out in the right unit. */
  priceUnit: string
  effectiveFrom: string
  terms: UsageTerms
  /**
   * False when the price is as it was: only the terms go out, so no new price
   * starts. Absent counts as changed.
   */
  priceChanged?: boolean
  /** The terms the line had: only what changed is sent, and what was removed is cleared. */
  previousTerms?: UsageTerms
}

/** Whether two sets of terms say the same thing (windows included). */
export function sameUsageTerms(a: UsageTerms, b: UsageTerms): boolean {
  return (
    a.bucketSize === b.bucketSize && JSON.stringify(a.commitment) === JSON.stringify(b.commitment)
  )
}

export interface ContractTermsErrors {
  quantity?: string
  commitmentValue?: string
  overageFactor?: string
  windows?: string
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
    if (!DECIMAL.test(value) || (Number(value) <= 0 && !commitment.windows?.length))
      errors.commitmentValue = 'Enter a commitment greater than zero.'
    else if (
      commitment.kind === CommitmentKind.Quantity &&
      Number(value) !== 0 &&
      !WHOLE.test(value)
    )
      errors.commitmentValue = 'Enter a whole number of units.'
    const factor = commitment.overageFactor.trim()
    if (!DECIMAL.test(factor) || Number(factor) < 1)
      errors.overageFactor = 'Enter 1 or more. 1 means no overage premium.'
  }
  const windows = commitment?.windows ?? []
  const minutes = (clock: string) =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(clock)
      ? Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3))
      : clock === '24:00'
        ? 1440
        : NaN
  const intervals: [number, number][] = []
  for (const window of windows) {
    const start = minutes(window.start),
      end = minutes(window.end)
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= 1440 ||
      start === end ||
      !DECIMAL.test(window.value.trim()) ||
      Number(window.value) <= 0 ||
      !DECIMAL.test(window.overageFactor.trim()) ||
      Number(window.overageFactor) < 1 ||
      ((window.kind ?? commitment?.kind) === CommitmentKind.Quantity &&
        !WHOLE.test(window.value.trim()))
    ) {
      errors.windows = 'Each window needs valid UTC times and a commitment above zero.'
      break
    }
    const spans: [number, number][] =
      start < end
        ? [[start, end]]
        : [
            [start, 1440],
            [0, end],
          ]
    for (const span of spans) {
      if (intervals.some(([a, b]) => span[0] < b && span[1] > a))
        errors.windows = 'Time windows must not overlap.'
      intervals.push(span)
    }
  }
  return errors
}

export const hasTermsErrors = (errors: ContractTermsErrors) => Object.keys(errors).length > 0
