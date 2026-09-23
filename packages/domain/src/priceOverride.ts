import { z } from 'zod'

/**
 * A price override, as a schema rather than as twelve pieces of state.
 *
 * V1's `PriceOverrideDialog.tsx` is 807 lines holding **twelve `useState`
 * hooks** — billing model, tier mode, a tiers array, transform quantity, an
 * effective date, bucket size, quantity, commitment, plus a duplicate copy of
 * the commitment kept only to diff against. The rules relating those fields
 * are spread across render branches and effects, so "is this form valid" has
 * no single answer and every new rule lands somewhere slightly different.
 *
 * The shape is genuinely a discriminated union: the billing model decides
 * which other fields exist at all. Written as one, validation stops being
 * conditional rendering and becomes a type.
 *
 * These are *product* rules, not form plumbing — a tiered price with
 * overlapping tiers is wrong no matter what draws it — so they live in the
 * domain, and the UI and any agent-driven action validate identically.
 */

/** Decimal string, as the API sends and expects. Never a float. */
const decimal = z
  .string()
  .trim()
  .min(1, 'Enter an amount')
  .regex(/^-?\d+(\.\d+)?$/, 'Enter a number, for example 9.99')

const nonNegative = decimal.refine((v) => !v.startsWith('-'), 'Amount cannot be negative')

export const BillingModel = {
  FlatFee: 'FLAT_FEE',
  Package: 'PACKAGE',
  Tiered: 'TIERED',
} as const
export type BillingModel = (typeof BillingModel)[keyof typeof BillingModel]

export const TierMode = {
  /** One rate for everything, chosen by the total. */
  Volume: 'VOLUME',
  /** Each band charged at its own rate. */
  Slab: 'SLAB',
} as const
export type TierMode = (typeof TierMode)[keyof typeof TierMode]

/**
 * One tier band.
 *
 * `upTo` absent means "and everything above", which is why exactly one tier may
 * omit it and it has to be the last.
 */
export const priceTierSchema = z.object({
  upTo: z.number().int().positive('Must be greater than zero').nullable(),
  unitAmount: nonNegative,
  flatAmount: nonNegative.optional(),
})
export type PriceTier = z.infer<typeof priceTierSchema>

/**
 * Tier bands must climb, and end open.
 *
 * Both failures are silent in V1: overlapping bands simply bill the wrong
 * amount, and a closed final band drops usage above it on the floor. Neither
 * shows up until an invoice is wrong, which is the worst possible time.
 */
const tiersSchema = z
  .array(priceTierSchema)
  .min(1, 'Add at least one tier')
  .superRefine((tiers, ctx) => {
    tiers.forEach((tier, index) => {
      const isLast = index === tiers.length - 1

      if (!isLast && tier.upTo === null) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'upTo'],
          message: 'Only the last tier can be unbounded',
        })
        return
      }

      const previous = tiers[index - 1]
      if (previous?.upTo != null && tier.upTo != null && tier.upTo <= previous.upTo) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'upTo'],
          message: `Must be greater than ${previous.upTo}`,
        })
      }
    })

    if (tiers.at(-1)?.upTo !== null) {
      ctx.addIssue({
        code: 'custom',
        path: [tiers.length - 1, 'upTo'],
        message: 'The last tier must be unbounded, or usage above it is not billed',
      })
    }
  })

const base = { priceId: z.string().min(1) }

export const priceOverrideSchema = z.discriminatedUnion('billingModel', [
  z.object({
    ...base,
    billingModel: z.literal(BillingModel.FlatFee),
    amount: nonNegative,
  }),
  z.object({
    ...base,
    billingModel: z.literal(BillingModel.Package),
    amount: nonNegative,
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
        tiers: [{ upTo: null, unitAmount: '' }],
      }
  }
}

/** Human labels, defined beside the values so the two cannot drift. */
export const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  [BillingModel.FlatFee]: 'Flat fee',
  [BillingModel.Package]: 'Package',
  [BillingModel.Tiered]: 'Tiered',
}

export const TIER_MODE_LABEL: Record<TierMode, string> = {
  [TierMode.Volume]: 'Volume — one rate for the whole quantity',
  [TierMode.Slab]: 'Slab — each band at its own rate',
}
