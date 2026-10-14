/**
 * A charge, as the plan/add-on/cost-sheet detail pages read it, plus the rules
 * for creating one.
 *
 * The one architectural fact this file encodes: a plan's *money* does not live
 * on the plan record. A plan (or add-on, or cost-sheet) carries only a name and
 * a lookup key; its charges are separate `Price` records reached through
 * `/prices/*`, tagged with an `entity_type`. So a "charge" is a price, and the
 * charge editor is built once and parameterised by the entity it prices.
 *
 * These are *product* rules, not form plumbing — a tiered charge with
 * overlapping bands is wrong no matter what draws it — so validation lives here,
 * once, and the UI and any agent-driven action validate identically. The shape
 * is the same discriminated union `priceOverride` proved out: the billing model
 * decides which other fields exist at all, so switching models cannot leave dead
 * state behind.
 *
 * This is also the single home for the pricing enums the whole catalogue shares
 * — `priceOverride` imports them from here rather than keeping a second copy.
 */
import { z } from 'zod'

/** Decimal string, as the API sends and expects. Never a float. */
const decimal = z
  .string()
  .trim()
  .min(1, 'Enter an amount')
  .regex(/^-?\d+(\.\d+)?$/, 'Enter a number, for example 9.99')

/** A money amount that may not be negative — the common case for a price. */
export const nonNegativeAmount = decimal.refine(
  (v) => !v.startsWith('-'),
  'Amount cannot be negative',
)

/**
 * Fixed or usage-based.
 *
 * A fixed charge bills the same every period (a subscription base); a usage
 * charge meters an event and bills what was consumed. The distinction decides
 * the whole shape of the form — a usage charge needs a meter, a fixed one an
 * invoice cadence — so it is the first thing the editor asks.
 */
export const PriceType = {
  Fixed: 'FIXED',
  Usage: 'USAGE',
} as const
export type PriceType = (typeof PriceType)[keyof typeof PriceType]

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  [PriceType.Fixed]: 'Fixed',
  [PriceType.Usage]: 'Usage',
}

/**
 * How the amount is applied.
 *
 * The canonical definition for the whole catalogue — `priceOverride` and the
 * charge editor both read it from here, so the two can never drift apart.
 */
export const BillingModel = {
  /** One rate for the whole quantity. */
  FlatFee: 'FLAT_FEE',
  /** A rate per package of N units. */
  Package: 'PACKAGE',
  /** Bands, each with its own rate. */
  Tiered: 'TIERED',
} as const
export type BillingModel = (typeof BillingModel)[keyof typeof BillingModel]

export const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  [BillingModel.FlatFee]: 'Flat fee',
  [BillingModel.Package]: 'Package',
  [BillingModel.Tiered]: 'Tiered',
}

export const TierMode = {
  /** One rate for everything, chosen by the total. */
  Volume: 'VOLUME',
  /** Each band charged at its own rate. */
  Slab: 'SLAB',
} as const
export type TierMode = (typeof TierMode)[keyof typeof TierMode]

export const TIER_MODE_LABEL: Record<TierMode, string> = {
  [TierMode.Volume]: 'Volume — one rate for the whole quantity',
  [TierMode.Slab]: 'Slab — each band at its own rate',
}

/**
 * How often a charge recurs. The `ONETIME` member is a one-off fee rather than
 * a cadence, but the wire keeps it in the same enum, so it is here too.
 */
export const BillingPeriod = {
  Daily: 'DAILY',
  Weekly: 'WEEKLY',
  Monthly: 'MONTHLY',
  Quarterly: 'QUARTERLY',
  HalfYearly: 'HALF_YEARLY',
  Annual: 'ANNUAL',
  OneTime: 'ONETIME',
} as const
export type BillingPeriod = (typeof BillingPeriod)[keyof typeof BillingPeriod]

export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  [BillingPeriod.Daily]: 'Daily',
  [BillingPeriod.Weekly]: 'Weekly',
  [BillingPeriod.Monthly]: 'Monthly',
  [BillingPeriod.Quarterly]: 'Quarterly',
  [BillingPeriod.HalfYearly]: 'Half-yearly',
  [BillingPeriod.Annual]: 'Annual',
  [BillingPeriod.OneTime]: 'One-time',
}

/** Billing period, shortened the way a pricing page writes it — "/mo", "/yr". */
export const BILLING_PERIOD_SHORT: Record<BillingPeriod, string> = {
  [BillingPeriod.Daily]: 'day',
  [BillingPeriod.Weekly]: 'week',
  [BillingPeriod.Monthly]: 'mo',
  [BillingPeriod.Quarterly]: 'quarter',
  [BillingPeriod.HalfYearly]: '6 mo',
  [BillingPeriod.Annual]: 'yr',
  [BillingPeriod.OneTime]: 'once',
}

/**
 * When the charge is invoiced relative to the period it covers.
 *
 * `ADVANCE` bills at the start (a subscription base, paid up front); `ARREAR`
 * bills at the end (usage, once it is known). A usage charge is almost always
 * arrear — you cannot bill for consumption before it happens.
 */
export const InvoiceCadence = {
  Advance: 'ADVANCE',
  Arrear: 'ARREAR',
} as const
export type InvoiceCadence = (typeof InvoiceCadence)[keyof typeof InvoiceCadence]

export const INVOICE_CADENCE_LABEL: Record<InvoiceCadence, string> = {
  [InvoiceCadence.Advance]: 'Advance — bill at the start of the period',
  [InvoiceCadence.Arrear]: 'Arrears — bill at the end of the period',
}

/**
 * What a set of charges prices.
 *
 * One editor serves all three; the entity type is what it carries in each
 * `Price`. The wire spells cost-sheet `COSTSHEET`, no underscore — kept exactly,
 * because a mapper that "tidies" it produces prices the backend cannot place.
 */
export const PriceEntityType = {
  Plan: 'PLAN',
  Addon: 'ADDON',
  CostSheet: 'COSTSHEET',
} as const
export type PriceEntityType = (typeof PriceEntityType)[keyof typeof PriceEntityType]

/**
 * How PACKAGE and volume pricing divide a quantity into billable units.
 *
 * "$2 per 1,000 tokens" is `divideBy: 1000`; `round` decides what a partial
 * package costs. The API keeps it as a nested object, so the domain does too.
 */
export const RoundType = {
  Up: 'up',
  Down: 'down',
} as const
export type RoundType = (typeof RoundType)[keyof typeof RoundType]

/**
 * One tier band.
 *
 * `upTo` absent means "and everything above", which is why exactly one tier may
 * omit it and it has to be the last. This is the same shape a price override
 * uses, so both surfaces share one schema.
 */
export const priceTierSchema = z.object({
  upTo: z.number().int().positive('Must be greater than zero').nullable(),
  unitAmount: nonNegativeAmount,
  flatAmount: nonNegativeAmount.optional(),
})
export type PriceTier = z.infer<typeof priceTierSchema>
/** The plan's name for the same thing. `PriceTier` is the override's. */
export type Tier = PriceTier

/**
 * Tier bands must climb, and end open.
 *
 * Both failures are silent otherwise: overlapping bands bill the wrong amount,
 * and a closed final band drops usage above it on the floor. Neither shows up
 * until an invoice is wrong, which is the worst possible time. Exported so the
 * override union and the charge union validate tiers identically.
 */
export const tiersSchema = z
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

/**
 * A charge, as the detail page's charges table reads it.
 *
 * Amounts are the strings the API sends — `amount` the raw decimal, and, when
 * present, `displayAmount` the value already formatted with a currency symbol.
 * A charge is never a float here; money that must not lose a cent stays a
 * string until the moment it is shown.
 */
export interface Charge {
  id: string
  type: PriceType
  billingModel: BillingModel
  /** Raw decimal, e.g. `"12.50"`. Empty for a purely tiered charge. */
  amount: string
  /** Formatted with a symbol, e.g. `"$12.50"`, when the API provided it. */
  displayAmount: string
  /** ISO currency, as the API sends it (lowercase, e.g. `"usd"`). */
  currency: string
  billingPeriod: BillingPeriod
  billingPeriodCount: number
  invoiceCadence: InvoiceCadence
  /** `RECURRING` for a periodic charge; a plain string, since the wire may add more. */
  billingCadence: string
  /** The tier mode for a TIERED charge, else null. */
  tierMode: TierMode | null
  tiers: Tier[]
  /** Package/volume divisor, when the charge uses one. */
  transformQuantity: { divideBy: number; round: RoundType | null } | null
  /** The meter a USAGE charge bills against, else null. */
  meterId: string | null
  /** The meter's name, when the response expanded it — for the table's benefit. */
  meterName: string | null
  entityType: PriceEntityType
  entityId: string
  lookupKey: string
  description: string
  displayName: string
  /** Free trial length in days, for a recurring fixed charge that has one. */
  trialPeriodDays?: number | null
  /** The custom price unit (e.g. `TOK`) the charge is denominated in; absent for plain currency. */
  priceUnit?: string | null
  createdAt: Date | null
}

/**
 * The rules for creating a charge.
 *
 * A discriminated union on the billing model, exactly like `priceOverride`:
 * validation stops being conditional rendering and becomes a type. The common
 * fields every charge shares sit in `chargeBase`; the `superRefine` at the end
 * carries the one cross-field rule a union cannot — a usage charge must name the
 * meter it bills.
 */
const chargeBase = {
  type: z.enum([PriceType.Fixed, PriceType.Usage]),
  currency: z.string().trim().min(1, 'Choose a currency'),
  billingPeriod: z.enum([
    BillingPeriod.Daily,
    BillingPeriod.Weekly,
    BillingPeriod.Monthly,
    BillingPeriod.Quarterly,
    BillingPeriod.HalfYearly,
    BillingPeriod.Annual,
    BillingPeriod.OneTime,
  ]),
  invoiceCadence: z.enum([InvoiceCadence.Advance, InvoiceCadence.Arrear]),
  /** Required only for USAGE — enforced in the refine below, not by the union. */
  meterId: z.string().trim().optional(),
  /** A human label for the charge, optional. */
  displayName: z.string().trim().optional(),
  /** Free-trial days for a fixed charge; absent means no trial. */
  trialPeriodDays: z.number().int().positive('Must be greater than zero').optional(),
  /** A custom price unit's code; absent means the charge is priced in `currency`. */
  priceUnit: z.string().trim().optional(),
  /** Edit only: the ISO date (`YYYY-MM-DD`) a changed price takes effect, as a new version. */
  effectiveFrom: z.string().trim().optional(),
  /** Create only: the price group the charge joins, for reporting and bulk changes. */
  groupId: z.string().trim().optional(),
  /** Create only: the ISO date (`YYYY-MM-DD`) the price starts; absent means now. */
  startDate: z.string().trim().optional(),
  /** Create only, fixed charges: the fewest units a subscriber can hold. */
  minQuantity: z
    .number({ error: 'Enter a whole number' })
    .int('Must be a whole number')
    .nonnegative('Must be 0 or more')
    .optional(),
}

export const createChargeSchema = z
  .discriminatedUnion('billingModel', [
    z.object({
      ...chargeBase,
      billingModel: z.literal(BillingModel.FlatFee),
      amount: nonNegativeAmount,
    }),
    z.object({
      ...chargeBase,
      billingModel: z.literal(BillingModel.Package),
      amount: nonNegativeAmount,
      /** Price is per package of this many units, so zero is meaningless. */
      divideBy: z
        .number({ error: 'Enter a package size' })
        .int('Must be a whole number')
        .positive('Must be greater than zero'),
    }),
    z.object({
      ...chargeBase,
      billingModel: z.literal(BillingModel.Tiered),
      tierMode: z.enum([TierMode.Volume, TierMode.Slab]),
      tiers: tiersSchema,
    }),
  ])
  .superRefine((charge, ctx) => {
    if (charge.type === PriceType.Usage && !charge.meterId) {
      ctx.addIssue({
        code: 'custom',
        path: ['meterId'],
        message: 'Choose the feature this charge meters',
      })
    }
  })

export type CreateCharge = z.infer<typeof createChargeSchema>

/**
 * A blank draft, so the editor starts on a coherent shape for every model.
 *
 * A form that opens already showing errors teaches people to ignore them, so
 * amounts are blank (and do fail) but structure never is. A usage charge
 * defaults to arrears — you cannot bill consumption before it happens — and a
 * fixed one to advance, the base a customer pays up front.
 */
export function emptyCharge(type: PriceType, billingModel: BillingModel): CreateCharge {
  const base = {
    type,
    currency: 'USD',
    billingPeriod: BillingPeriod.Monthly,
    invoiceCadence: type === PriceType.Usage ? InvoiceCadence.Arrear : InvoiceCadence.Advance,
    ...(type === PriceType.Usage ? { meterId: '' } : {}),
  }

  switch (billingModel) {
    case BillingModel.FlatFee:
      return { ...base, billingModel, amount: '' }
    case BillingModel.Package:
      return { ...base, billingModel, amount: '', divideBy: 1 }
    case BillingModel.Tiered:
      return {
        ...base,
        billingModel,
        tierMode: TierMode.Volume,
        // Opens with the unbounded final tier already present, because a form
        // that starts invalid teaches people to ignore its errors.
        tiers: [{ upTo: null, unitAmount: '' }],
      }
  }
}

/**
 * A saved charge, back as the draft the editor edits.
 *
 * The inverse of what `toChargeRequest` sends: only what the billing model uses
 * is carried, so an edit opens on a structurally valid shape.
 */
export function chargeToDraft(charge: Charge): CreateCharge {
  const base = {
    type: charge.type,
    currency: (charge.currency || 'USD').toUpperCase(),
    billingPeriod: charge.billingPeriod,
    invoiceCadence: charge.invoiceCadence,
    ...(charge.meterId ? { meterId: charge.meterId } : {}),
    ...(charge.displayName ? { displayName: charge.displayName } : {}),
    ...(charge.trialPeriodDays ? { trialPeriodDays: charge.trialPeriodDays } : {}),
    ...(charge.priceUnit ? { priceUnit: charge.priceUnit } : {}),
  }

  switch (charge.billingModel) {
    case BillingModel.Package:
      return {
        ...base,
        billingModel: BillingModel.Package,
        amount: charge.amount || '0',
        divideBy: charge.transformQuantity?.divideBy ?? 1,
      }
    case BillingModel.Tiered:
      return {
        ...base,
        billingModel: BillingModel.Tiered,
        tierMode: charge.tierMode ?? TierMode.Volume,
        tiers: charge.tiers,
      }
    case BillingModel.FlatFee:
      return { ...base, billingModel: BillingModel.FlatFee, amount: charge.amount || '0' }
  }
}
