import { z } from 'zod'
import { BucketSize } from './contractCharge'
import {
  BillingModel,
  TierMode,
  nonNegativeAmount,
  tiersSchema,
  type Charge,
  type Tier,
} from './price'

/**
 * A price override, as a schema rather than as twelve pieces of state.
 *
 * V1's `PriceOverrideDialog.tsx` is 807 lines holding **twelve `useState`
 * hooks**: billing model, tier mode, a tiers array, transform quantity, an
 * effective date, bucket size, quantity, commitment, plus a duplicate copy of
 * the commitment kept only to diff against. The rules relating those fields
 * are spread across render branches and effects, so "is this form valid" has
 * no single answer and every new rule lands somewhere slightly different.
 *
 * The shape is genuinely a discriminated union: the billing model decides
 * which other fields exist at all. Written as one, validation stops being
 * conditional rendering and becomes a type.
 *
 * These are *product* rules, not form plumbing: a tiered price with
 * overlapping tiers is wrong no matter what draws it: so they live in the
 * domain, and the UI and any agent-driven action validate identically.
 *
 * The pricing enums and the tier schema this builds on are defined once in
 * `./price`: a charge and an override are the same money, described the same
 * way: and re-exported here so this file's long-standing callers and tests
 * keep their import site.
 */

export {
  BillingModel,
  TierMode,
  BILLING_MODEL_LABEL,
  TIER_MODE_LABEL,
  priceTierSchema,
} from './price'
export type { PriceTier } from './price'

const base = {
  priceId: z.string().min(1),
  /**
   * Usage charges only: the window usage is summed in before it is priced
   * (`bucket_size` on the override). Blank keeps the charge's own.
   */
  // Lazy: `contractCharge` imports this module, so `BucketSize` is read on first parse, not at load.
  bucketSize: z.lazy(() => z.union([z.literal(''), z.enum(BucketSize)])).optional(),
}

export const priceOverrideSchema = z.discriminatedUnion('billingModel', [
  z.object({
    ...base,
    billingModel: z.literal(BillingModel.FlatFee),
    amount: nonNegativeAmount,
  }),
  z.object({
    ...base,
    billingModel: z.literal(BillingModel.Package),
    amount: nonNegativeAmount,
    /** Price is per package of this many units, so zero is meaningless. */
    divideBy: z
      .number({ error: 'Enter a package size' })
      .int('Must be a whole number')
      .positive('Must be greater than zero'),
  }),
  z.object({
    ...base,
    billingModel: z.literal(BillingModel.Tiered),
    tierMode: z.enum([TierMode.Volume, TierMode.Slab]),
    tiers: tiersSchema,
  }),
])

export type PriceOverride = z.infer<typeof priceOverrideSchema>

const BUCKETS = new Set<string>(Object.values(BucketSize))

/**
 * The override dialog opens on the charge's own model.
 *
 * A tiered plan price starts on Tiered, with its bands, rather than on an empty
 * flat fee. The person can still switch model; this is only the starting shape.
 */
export function overrideFromCharge(
  charge: Pick<
    Charge,
    'id' | 'billingModel' | 'amount' | 'tierMode' | 'tiers' | 'transformQuantity' | 'bucketSize'
  >,
): PriceOverride {
  const bucketSize =
    charge.bucketSize && BUCKETS.has(charge.bucketSize)
      ? { bucketSize: charge.bucketSize as (typeof BucketSize)[keyof typeof BucketSize] }
      : {}
  switch (charge.billingModel) {
    case BillingModel.Package:
      return {
        priceId: charge.id,
        billingModel: BillingModel.Package,
        amount: charge.amount || '',
        divideBy: charge.transformQuantity?.divideBy ?? 1,
        ...bucketSize,
      }
    case BillingModel.Tiered:
      return {
        priceId: charge.id,
        billingModel: BillingModel.Tiered,
        tierMode: charge.tierMode ?? TierMode.Volume,
        tiers:
          charge.tiers.length > 0
            ? charge.tiers.map(tierForOverride)
            : [{ upTo: null, unitAmount: '', flatAmount: '0' }],
        ...bucketSize,
      }
    case BillingModel.FlatFee:
      return {
        priceId: charge.id,
        billingModel: BillingModel.FlatFee,
        amount: charge.amount || '',
        ...bucketSize,
      }
  }
}

function tierForOverride(tier: Tier): Tier {
  return {
    upTo: tier.upTo,
    unitAmount: tier.unitAmount,
    ...(tier.flatAmount != null && tier.flatAmount !== '' ? { flatAmount: tier.flatAmount } : {}),
    ...(tier.transformQuantity ? { transformQuantity: tier.transformQuantity } : {}),
  }
}

/** A starting value for each model, so switching models never lands on invalid state. */
export function emptyOverride(priceId: string, billingModel: BillingModel): PriceOverride {
  switch (billingModel) {
    case BillingModel.FlatFee:
      return { priceId, billingModel, amount: '' }
    case BillingModel.Package:
      return { priceId, billingModel, amount: '', divideBy: 1 }
    case BillingModel.Tiered:
      return {
        priceId,
        billingModel,
        tierMode: TierMode.Volume,
        // Opens with the unbounded final tier already present, because a form
        // that starts invalid teaches people to ignore its errors.
        tiers: [{ upTo: null, unitAmount: '', flatAmount: '0' }],
      }
  }
}
