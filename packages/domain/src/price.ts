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
 * These are *product* rules, not form plumbing: a tiered charge with
 * overlapping bands is wrong no matter what draws it: so validation lives here,
 * once, and the UI and any agent-driven action validate identically. The shape
 * is the same discriminated union `priceOverride` proved out: the billing model
 * decides which other fields exist at all, so switching models cannot leave dead
 * state behind.
 *
 * This is also the single home for the pricing enums the whole catalogue shares
 *: `priceOverride` imports them from here rather than keeping a second copy.
 */
import { z } from 'zod'
import { formatUnitAmount } from './money'

/** Decimal string, as the API sends and expects. Never a float. */
const decimal = z
  .string()
  .trim()
  .min(1, 'Enter an amount')
  .regex(/^-?\d+(\.\d+)?$/, 'Enter a number, for example 9.99')

/** A money amount that may not be negative: the common case for a price. */
export const nonNegativeAmount = decimal.refine(
  (v) => !v.startsWith('-'),
  'Amount cannot be negative',
)

/**
 * How a usage charge windows its meter before pricing it.
 *
 * Bucketing cuts the billing period into fixed windows, aggregates the meter
 * inside each one, and prices the windows. A MAX meter bucketed by DAY bills
 * the sum of each day's peak rather than one peak for the month, which is how
 * "peak concurrent seats, charged daily" is expressed.
 *
 * Only the sub-day-to-day sizes are offered. The meter-level enum also has
 * WEEK and MONTH, but a window at or above the billing period prices the whole
 * period as one bucket, which is what an unbucketed charge already does.
 *
 * The API calls this `bucket_size`; the form calls it a usage window, because
 * "bucket" names the implementation and "window" names what it does.
 */
export const PriceWindowSize = {
  Minute: 'MINUTE',
  FifteenMin: '15MIN',
  ThirtyMin: '30MIN',
  Hour: 'HOUR',
  ThreeHour: '3HOUR',
  SixHour: '6HOUR',
  TwelveHour: '12HOUR',
  Day: 'DAY',
} as const
export type PriceWindowSize = (typeof PriceWindowSize)[keyof typeof PriceWindowSize]

export const PRICE_WINDOW_SIZE_LABEL: Record<PriceWindowSize, string> = {
  [PriceWindowSize.Minute]: 'Every minute',
  [PriceWindowSize.FifteenMin]: 'Every 15 minutes',
  [PriceWindowSize.ThirtyMin]: 'Every 30 minutes',
  [PriceWindowSize.Hour]: 'Hourly',
  [PriceWindowSize.ThreeHour]: 'Every 3 hours',
  [PriceWindowSize.SixHour]: 'Every 6 hours',
  [PriceWindowSize.TwelveHour]: 'Every 12 hours',
  [PriceWindowSize.Day]: 'Daily',
}

/**
 * The aggregations a window is meaningful for.
 *
 * The API refuses any other: windowing a COUNT or a COUNT_UNIQUE would just
 * re-count the same events in smaller pieces and sum to the same number, so
 * only MAX and SUM change their answer when bucketed.
 */
export const WINDOWABLE_AGGREGATIONS = ['MAX', 'SUM'] as const

/**
 * Fixed or usage-based.
 *
 * A fixed charge bills the same every period (a subscription base); a usage
 * charge meters an event and bills what was consumed. The distinction decides
 * the whole shape of the form: a usage charge needs a meter, a fixed one an
 * invoice cadence: so it is the first thing the editor asks.
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
 * The canonical definition for the whole catalogue: `priceOverride` and the
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
  [TierMode.Volume]: 'Volume: one rate for the whole quantity',
  [TierMode.Slab]: 'Slab: each band at its own rate',
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

/**
 * A recurring period as a noun, one and many: what follows "every" or "per".
 * Keyed by the wire value, which billing periods, credit grant periods and
 * usage reset periods share.
 */
const PERIOD_NOUN: Record<string, readonly [one: string, many: string]> = {
  DAILY: ['day', 'days'],
  WEEKLY: ['week', 'weeks'],
  MONTHLY: ['month', 'months'],
  QUARTERLY: ['quarter', 'quarters'],
  HALF_YEARLY: ['half-year', 'half-years'],
  ANNUAL: ['year', 'years'],
}

/** "month", "quarter": one period, as a noun. */
export function periodNoun(period: string): string {
  return PERIOD_NOUN[period]?.[0] ?? period.toLowerCase()
}

/**
 * "every month", "every 3 months": never "every monthly". The adjective labels
 * ("Monthly") stand alone; after "every" a period is a noun.
 */
export function everyPeriod(period: string, count = 1): string {
  const [one, many] = PERIOD_NOUN[period] ?? [period.toLowerCase(), period.toLowerCase()]
  return count > 1 ? `every ${count} ${many}` : `every ${one}`
}

/** Billing period, shortened the way a pricing page writes it: "/mo", "/yr". */
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
 * arrear: you cannot bill for consumption before it happens.
 */
export const InvoiceCadence = {
  Advance: 'ADVANCE',
  Arrear: 'ARREAR',
} as const
export type InvoiceCadence = (typeof InvoiceCadence)[keyof typeof InvoiceCadence]

export const INVOICE_CADENCE_LABEL: Record<InvoiceCadence, string> = {
  [InvoiceCadence.Advance]: 'Advance: bill at the start of the period',
  [InvoiceCadence.Arrear]: 'Arrears: bill at the end of the period',
}

/**
 * What a set of charges prices.
 *
 * One editor serves all three; the entity type is what it carries in each
 * `Price`. The wire spells cost-sheet `COSTSHEET`, no underscore: kept exactly,
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
  /** Prices the band per package of `divideBy` units; absent or 0 means per unit. */
  transformQuantity: z
    .object({
      divideBy: z.number().int('Must be a whole number').nonnegative(),
      round: z.enum([RoundType.Up, RoundType.Down]),
    })
    .optional(),
})
export type PriceTier = z.infer<typeof priceTierSchema>
/** The plan's name for the same thing. `PriceTier` is the override's. */
export type Tier = PriceTier

/**
 * Applies a typed package size; empty or zero clears it to 0 so the band's rounding survives a retype.
 * Anything but digits and grouping commas leaves the tier unchanged, so "1.5" never saves as 15.
 */
export function withPackageSize(tier: Tier, input: string): Tier {
  const digits = input.replace(/,/g, '').trim()
  if (!/^\d*$/.test(digits)) return tier
  const { transformQuantity, ...rest } = tier
  const divideBy = Number(digits)
  if (!divideBy)
    return transformQuantity
      ? { ...rest, transformQuantity: { ...transformQuantity, divideBy: 0 } }
      : rest
  return {
    ...rest,
    transformQuantity: { divideBy, round: transformQuantity?.round ?? RoundType.Up },
  }
}

/** "per unit", or "per 1,000 units" for a package band. */
export function tierUnitLabel(tier: Tier): string {
  const divideBy = tier.transformQuantity?.divideBy
  return divideBy ? `per ${divideBy.toLocaleString('en-US')} units` : 'per unit'
}

/**
 * The bands a charge is priced in: its custom unit's when it has one, else
 * its currency's. A custom-unit charge carries both, and the unit's are the
 * ones it was set with.
 */
export function chargePricedTiers(
  charge: Pick<Charge, 'tiers' | 'priceUnit' | 'priceUnitTiers'>,
): Tier[] {
  return charge.priceUnit && charge.priceUnitTiers?.length ? charge.priceUnitTiers : charge.tiers
}

/**
 * One of a charge's amounts as a label, in what the charge is priced in:
 * "2.4 QAU" for a custom unit, "$0.0005" for a currency.
 */
export function chargeAmountLabel(
  charge: Pick<Charge, 'currency' | 'priceUnit'>,
  amount: string,
): string {
  return charge.priceUnit
    ? `${amount} ${charge.priceUnit}`
    : formatUnitAmount(amount, charge.currency)
}

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
 * Amounts are the strings the API sends: `amount` the raw decimal, and, when
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
  /** The usage window this charge prices its meter over, else null. */
  bucketSize: PriceWindowSize | null
  /** The meter a USAGE charge bills against, else null. */
  meterId: string | null
  /** The meter's name, when the response expanded it: for the table's benefit. */
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
  /** With `priceUnit`: the amount in that unit (`"2.4"`); `amount` is its currency equivalent. */
  priceUnitAmount?: string | null
  /** With `priceUnit`: the bands in that unit; `tiers` are their currency equivalents. */
  priceUnitTiers?: Tier[]
  /** When this version of the charge took effect; null when the API did not say. */
  startDate: Date | null
  /**
   * When it stops billing, or null while it still does.
   *
   * A charge is ended, not deleted: `DELETE /prices/{id}` sets this date so the
   * invoices that referenced the charge stay explicable. It is what tells the
   * Active, Changed and Ended views apart.
   */
  endDate: Date | null
  /**
   * Which version of the charge this is, as the API counts them.
   *
   * Every price edit ends one version and starts the next, and `sequence`
   * numbers them. A charge whose sequence is above 1 has history worth a flag.
   */
  sequence: number | null
  /**
   * The first version of this charge (`parent_price_id`), when this is a later
   * one. An edit ends the old price and creates a new one pointing back here,
   * so every version of a charge shares it.
   */
  parentPriceId?: string | null
  createdAt: Date | null
}

/**
 * The rules for creating a charge.
 *
 * A discriminated union on the billing model, exactly like `priceOverride`:
 * validation stops being conditional rendering and becomes a type. The common
 * fields every charge shares sit in `chargeBase`; the `superRefine` at the end
 * carries the one cross-field rule a union cannot: a usage charge must name the
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
  /** Required only for USAGE: enforced in the refine below, not by the union. */
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
  /**
   * Usage charges only: the window the meter is aggregated over before pricing.
   *
   * Absent means no windowing: the meter aggregates across the whole billing
   * period. The API rejects a window on a fixed charge, on a meter that is not
   * MAX or SUM, and on a meter that already carries one of its own; the form
   * only offers the field where all three hold.
   */
  bucketSize: z
    .enum([
      PriceWindowSize.Minute,
      PriceWindowSize.FifteenMin,
      PriceWindowSize.ThirtyMin,
      PriceWindowSize.Hour,
      PriceWindowSize.ThreeHour,
      PriceWindowSize.SixHour,
      PriceWindowSize.TwelveHour,
      PriceWindowSize.Day,
    ])
    .optional(),
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
    // The API refuses this outright: a window has nothing to aggregate on a
    // charge that does not meter anything. Caught here so switching a charge
    // from usage to fixed cannot carry a stale window into the request.
    if (charge.type === PriceType.Fixed && charge.bucketSize) {
      ctx.addIssue({
        code: 'custom',
        path: ['bucketSize'],
        message: 'A usage window applies to metered charges only',
      })
    }
  })

export type CreateCharge = z.infer<typeof createChargeSchema>

/**
 * A blank draft, so the editor starts on a coherent shape for every model.
 *
 * A form that opens already showing errors teaches people to ignore them, so
 * amounts are blank (and do fail) but structure never is. A usage charge
 * defaults to arrears: you cannot bill consumption before it happens: and a
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
    ...(charge.type === PriceType.Usage && charge.bucketSize
      ? { bucketSize: charge.bucketSize }
      : {}),
  }

  // A custom-unit charge is edited in its unit (2.4 QAU), not the currency it converts to.
  const amount = charge.priceUnit && charge.priceUnitAmount ? charge.priceUnitAmount : charge.amount

  switch (charge.billingModel) {
    case BillingModel.Package:
      return {
        ...base,
        billingModel: BillingModel.Package,
        amount: amount || '0',
        divideBy: charge.transformQuantity?.divideBy ?? 1,
      }
    case BillingModel.Tiered:
      return {
        ...base,
        billingModel: BillingModel.Tiered,
        tierMode: charge.tierMode ?? TierMode.Volume,
        tiers: charge.priceUnit && charge.priceUnitTiers ? charge.priceUnitTiers : charge.tiers,
      }
    case BillingModel.FlatFee:
      return { ...base, billingModel: BillingModel.FlatFee, amount: amount || '0' }
  }
}

/**
 * Where one version of a charge sits in time.
 *
 * - `current`: started (now or earlier) and not yet ended: it bills now. A
 *   future end date keeps it current: it is scheduled to end, not ended.
 * - `upcoming`: starts in the future (a change scheduled for a later date).
 * - `history`: its end date has passed.
 */
export type VersionStatus = 'current' | 'upcoming' | 'history'

interface Dated {
  startDate: Date | null
  endDate: Date | null
}

export function versionStatus(version: Dated, now: number = Date.now()): VersionStatus {
  if (version.endDate && version.endDate.getTime() <= now) return 'history'
  if (version.startDate && version.startDate.getTime() > now) return 'upcoming'
  return 'current'
}

/**
 * Whether a charge has stopped billing: its end date has passed. A future end
 * date is scheduled, not ended: the charge still bills, still counts, and can
 * still be edited until then. `!charge.endDate` is not this test: it drops
 * every end-dated charge, a contract with a fixed term among them.
 */
export function chargeHasEnded(
  charge: { endDate: Date | null },
  now: number = Date.now(),
): boolean {
  return charge.endDate !== null && charge.endDate.getTime() <= now
}

/** How many of these charges still bill (end-dated ones whose end is ahead included). */
export function liveChargeCount(
  charges: readonly { endDate: Date | null }[],
  now: number = Date.now(),
): number {
  return charges.filter((charge) => !chargeHasEnded(charge, now)).length
}

/**
 * The version a charges table shows, from versions sorted newest first: the
 * one billing now. With none billing now, the next to start (a charge that is
 * only scheduled so far); with none of those either, the last to end.
 */
export function currentVersion<T extends Dated>(
  newestFirst: readonly T[],
  now: number = Date.now(),
): T {
  const current = newestFirst.find((version) => versionStatus(version, now) === 'current')
  if (current) return current
  const upcoming = newestFirst.filter((version) => versionStatus(version, now) === 'upcoming')
  return (upcoming[upcoming.length - 1] ?? newestFirst[0]) as T
}

/** One charge across its versions. */
export interface ChargeLineage {
  /** The version that bills now (`currentVersion`): never one only scheduled while another bills. */
  current: Charge
  /** Every version, newest first, `current` among them. */
  versions: Charge[]
}

/**
 * A catalogue record's prices grouped into the charges they are versions of.
 *
 * Editing a charge's price never rewrites it: the API ends the price and
 * creates a new one whose `parent_price_id` names the first version. Grouping
 * on that keeps the ended prices as what they are: earlier, inactive
 * versions of one charge: instead of rows of their own or nothing at all.
 */
export function chargeLineages(
  charges: readonly Charge[],
  now: number = Date.now(),
): ChargeLineage[] {
  const groups = new Map<string, Charge[]>()
  for (const charge of charges) {
    const root = charge.parentPriceId || charge.id
    groups.set(root, [...(groups.get(root) ?? []), charge])
  }
  const newestFirst = (a: Charge, b: Charge) =>
    (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0) ||
    (a.endDate ? 1 : 0) - (b.endDate ? 1 : 0) ||
    (b.sequence ?? 0) - (a.sequence ?? 0)
  return [...groups.values()].map((group) => {
    const versions = [...group].sort(newestFirst)
    return { current: currentVersion(versions, now), versions }
  })
}

/**
 * The start date a new catalogue price gets when none is chosen: the first of
 * January 2000, so a price is in effect for any subscription however far back
 * it starts. Starting prices "now" broke subscriptions that began earlier.
 */
export const OPEN_START_DATE = '2000-01-01'

/** A start on or before {@link OPEN_START_DATE}: shown as no start at all ("Ongoing"). */
export function isOpenStart(date: Date | null | undefined): boolean {
  return date != null && date.getTime() < Date.UTC(2000, 0, 2)
}
