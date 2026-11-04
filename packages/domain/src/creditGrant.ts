/**
 * A credit grant, as a plan's detail page reads it, plus the rules for making
 * one.
 *
 * A credit grant hands a subscriber a balance of credits they can spend against
 * usage. Watchtower's translation holds here: a *recurring* grant is a budget
 * that refreshes each period, a *one-time* grant is a top-up given once. Like
 * charges and entitlements, a grant is its own `/creditgrants` record tagged
 * with the plan it belongs to: but unlike them it is created one at a time,
 * there being no bulk endpoint.
 *
 * Two axes bend the shape independently: the cadence decides whether a period
 * is needed, the expiration type whether a duration is: so this is a base
 * object with a `superRefine`, not a discriminated union.
 */
import { z } from 'zod'

/** Decimal string, as the API sends and expects for `credits`. Never a float. */
const decimal = z
  .string()
  .trim()
  .min(1, 'Enter an amount')
  .regex(/^\d+(\.\d+)?$/, 'Enter a number, for example 100')

/**
 * One-time or recurring.
 *
 * A one-time grant is a single top-up; a recurring grant refreshes every period.
 * The cadence is the first choice because it decides whether a period applies.
 */
export const CreditGrantCadence = {
  OneTime: 'ONETIME',
  Recurring: 'RECURRING',
} as const
export type CreditGrantCadence = (typeof CreditGrantCadence)[keyof typeof CreditGrantCadence]

export const CREDIT_GRANT_CADENCE_LABEL: Record<CreditGrantCadence, string> = {
  [CreditGrantCadence.OneTime]: 'One-time',
  [CreditGrantCadence.Recurring]: 'Recurring',
}

/** How often a recurring grant refreshes. */
export const CreditGrantPeriod = {
  Daily: 'DAILY',
  Weekly: 'WEEKLY',
  Monthly: 'MONTHLY',
  Quarterly: 'QUARTERLY',
  HalfYearly: 'HALF_YEARLY',
  Annual: 'ANNUAL',
} as const
export type CreditGrantPeriod = (typeof CreditGrantPeriod)[keyof typeof CreditGrantPeriod]

export const CREDIT_GRANT_PERIOD_LABEL: Record<CreditGrantPeriod, string> = {
  [CreditGrantPeriod.Daily]: 'Daily',
  [CreditGrantPeriod.Weekly]: 'Weekly',
  [CreditGrantPeriod.Monthly]: 'Monthly',
  [CreditGrantPeriod.Quarterly]: 'Quarterly',
  [CreditGrantPeriod.HalfYearly]: 'Half-yearly',
  [CreditGrantPeriod.Annual]: 'Annual',
}

/** What a grant is attached to. Plans and add-ons, in this catalogue. */
export const CreditGrantScope = {
  Plan: 'PLAN',
  Addon: 'ADDON',
  Subscription: 'SUBSCRIPTION',
} as const
export type CreditGrantScope = (typeof CreditGrantScope)[keyof typeof CreditGrantScope]

/**
 * When the granted credits expire.
 *
 * `NEVER`: they persist; `BILLING_CYCLE`: they lapse at the end of the period;
 * `DURATION`: they last a fixed span, set by a duration and its unit.
 */
export const CreditGrantExpiryType = {
  Never: 'NEVER',
  BillingCycle: 'BILLING_CYCLE',
  Duration: 'DURATION',
} as const
export type CreditGrantExpiryType =
  (typeof CreditGrantExpiryType)[keyof typeof CreditGrantExpiryType]

export const CREDIT_GRANT_EXPIRY_TYPE_LABEL: Record<CreditGrantExpiryType, string> = {
  [CreditGrantExpiryType.Never]: 'Never expires',
  [CreditGrantExpiryType.BillingCycle]: 'Expires at the end of the billing period',
  [CreditGrantExpiryType.Duration]: 'Expires after a set duration',
}

export const CreditGrantExpiryDurationUnit = {
  Day: 'DAY',
  Week: 'WEEK',
  Month: 'MONTH',
  Year: 'YEAR',
} as const
export type CreditGrantExpiryDurationUnit =
  (typeof CreditGrantExpiryDurationUnit)[keyof typeof CreditGrantExpiryDurationUnit]

export const CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL: Record<
  CreditGrantExpiryDurationUnit,
  string
> = {
  [CreditGrantExpiryDurationUnit.Day]: 'Days',
  [CreditGrantExpiryDurationUnit.Week]: 'Weeks',
  [CreditGrantExpiryDurationUnit.Month]: 'Months',
  [CreditGrantExpiryDurationUnit.Year]: 'Years',
}

const EXPIRY_UNIT_NOUN: Record<CreditGrantExpiryDurationUnit, [string, string]> = {
  [CreditGrantExpiryDurationUnit.Day]: ['day', 'days'],
  [CreditGrantExpiryDurationUnit.Week]: ['week', 'weeks'],
  [CreditGrantExpiryDurationUnit.Month]: ['month', 'months'],
  [CreditGrantExpiryDurationUnit.Year]: ['year', 'years'],
}

/**
 * When a grant's credits expire, in words: "Never expires", "Expires at the
 * end of the billing period", or "Expires after 9 days" ("1 day", not "1
 * days"). A duration grant names its length; only one with no length falls
 * back to the generic "after a set duration". Takes a saved grant or a draft.
 */
export function creditGrantExpiryLabel(grant: {
  expirationType: CreditGrantExpiryType
  expirationDuration?: number | null | undefined
  expirationDurationUnit?: CreditGrantExpiryDurationUnit | null | undefined
}): string {
  const length = grant.expirationDuration
  if (grant.expirationType === CreditGrantExpiryType.Duration && length && length > 0) {
    // A draft with no unit yet shows the form's default, days.
    const [one, many] =
      EXPIRY_UNIT_NOUN[grant.expirationDurationUnit ?? CreditGrantExpiryDurationUnit.Day]
    return `Expires after ${length} ${length === 1 ? one : many}`
  }
  return CREDIT_GRANT_EXPIRY_TYPE_LABEL[grant.expirationType]
}

/** A credit grant, as the plan's Credit Grants tab reads it. */
export interface CreditGrant {
  id: string
  name: string
  scope: CreditGrantScope
  /** The number of credits granted, as the API's string. */
  credits: string
  cadence: CreditGrantCadence
  /** The period a recurring grant refreshes on, else null. */
  period: CreditGrantPeriod | null
  periodCount: number | null
  expirationType: CreditGrantExpiryType
  expirationDuration: number | null
  expirationDurationUnit: CreditGrantExpiryDurationUnit | null
  /** Credits-to-currency rate, when set (amount = credits × rate). */
  conversionRate: string | null
  priority: number
  /** When the grant stops issuing credits, if it has been given an end. */
  endDate?: Date | null
  metadata?: Record<string, string>
  createdAt: Date | null
}

/**
 * The rules for creating a credit grant.
 *
 * The base object holds everything a grant always has; the `superRefine` carries
 * the two conditional rules: a recurring grant needs a period, a duration
 * expiry needs a length: so a form cannot save a grant that refreshes on
 * nothing or expires after no time.
 */
export const createCreditGrantSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name'),
    /** Positive: a grant of zero credits grants nothing. */
    credits: decimal.refine((v) => Number(v) > 0, 'Must be greater than zero'),
    cadence: z.enum([CreditGrantCadence.OneTime, CreditGrantCadence.Recurring]),
    period: z
      .enum([
        CreditGrantPeriod.Daily,
        CreditGrantPeriod.Weekly,
        CreditGrantPeriod.Monthly,
        CreditGrantPeriod.Quarterly,
        CreditGrantPeriod.HalfYearly,
        CreditGrantPeriod.Annual,
      ])
      .optional(),
    periodCount: z.number().int().positive().optional(),
    expirationType: z.enum([
      CreditGrantExpiryType.Never,
      CreditGrantExpiryType.BillingCycle,
      CreditGrantExpiryType.Duration,
    ]),
    expirationDuration: z.number().int().positive('Must be greater than zero').optional(),
    expirationDurationUnit: z
      .enum([
        CreditGrantExpiryDurationUnit.Day,
        CreditGrantExpiryDurationUnit.Week,
        CreditGrantExpiryDurationUnit.Month,
        CreditGrantExpiryDurationUnit.Year,
      ])
      .optional(),
    /**
     * Optional; when present it must be a positive number. An empty string is
     * "no rate", not an error: otherwise an untouched field would block a save.
     */
    conversionRate: z
      .union([z.literal(''), decimal.refine((v) => Number(v) > 0, 'Must be greater than zero')])
      .optional(),
    priority: z.number().int().nonnegative('Cannot be negative'),
  })
  .superRefine((grant, ctx) => {
    if (grant.cadence === CreditGrantCadence.Recurring && !grant.period) {
      ctx.addIssue({ code: 'custom', path: ['period'], message: 'Choose a period' })
    }
    if (
      grant.expirationType === CreditGrantExpiryType.Duration &&
      grant.expirationDuration == null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expirationDuration'],
        message: 'Enter how long the credits last',
      })
    }
  })

export type CreateCreditGrant = z.infer<typeof createCreditGrantSchema>

/**
 * A blank draft, so the dialog opens coherent.
 *
 * Defaults mirror V1's: a one-time grant of free credits, monthly if it becomes
 * recurring, never expiring, top priority (0 is highest).
 */
export function emptyCreditGrant(): CreateCreditGrant {
  return {
    name: 'Free credits',
    credits: '',
    cadence: CreditGrantCadence.OneTime,
    period: CreditGrantPeriod.Monthly,
    periodCount: 1,
    expirationType: CreditGrantExpiryType.Never,
    // The unit the form shows before anyone picks one, so a duration typed
    // without touching it is sent in days rather than with no unit (a 400).
    expirationDurationUnit: CreditGrantExpiryDurationUnit.Day,
    priority: 0,
  }
}

/**
 * A saved grant as a draft: how a contract starts from its plan's grants and
 * lets them be changed for that contract alone.
 */
export function creditGrantToDraft(grant: CreditGrant): CreateCreditGrant {
  return {
    name: grant.name,
    credits: grant.credits,
    cadence: grant.cadence,
    ...(grant.period ? { period: grant.period } : {}),
    ...(grant.periodCount ? { periodCount: grant.periodCount } : {}),
    expirationType: grant.expirationType,
    ...(grant.expirationDuration ? { expirationDuration: grant.expirationDuration } : {}),
    ...(grant.expirationDurationUnit
      ? { expirationDurationUnit: grant.expirationDurationUnit }
      : {}),
    ...(grant.conversionRate ? { conversionRate: grant.conversionRate } : {}),
    priority: grant.priority,
  }
}

/**
 * What editing a credit grant can change: its name, its metadata and an end
 * date. The credits, cadence and expiry are fixed once issued: a grant already
 * applied to subscriptions cannot be re-priced: so they are not in this shape.
 * The backend rejects an end date in the past, and so does this.
 */
export const editCreditGrantSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  endDate: z
    .date({ error: 'Enter a valid date' })
    .refine((date) => date.getTime() > Date.now(), 'The end date cannot be in the past')
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type EditCreditGrant = z.infer<typeof editCreditGrantSchema>

/** An edit draft seeded from an existing grant. */
export function creditGrantToEdit(grant: CreditGrant): EditCreditGrant {
  return {
    name: grant.name,
    ...(grant.endDate ? { endDate: grant.endDate } : {}),
    ...(grant.metadata && Object.keys(grant.metadata).length > 0
      ? { metadata: grant.metadata }
      : {}),
  }
}
