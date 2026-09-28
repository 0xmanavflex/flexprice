/**
 * An entitlement, as a plan's detail page reads it, plus the rules for granting
 * one.
 *
 * An entitlement is what a plan *includes* of a feature — the metered allowance
 * ("50,000 API calls a month"), the flag that a boolean feature is on, the value
 * of a static one, or a config blob. Like charges and credit grants, it does not
 * live on the plan record: it is a separate `/entitlements/*` record tagged with
 * the plan (or add-on) it belongs to, and created in bulk.
 *
 * The feature's *type* decides the whole shape — a metered entitlement has a
 * limit and a reset period, a boolean one has neither — so the schema is a
 * discriminated union on it, and the drawer renders exactly the fields the
 * chosen feature needs.
 */
import { z } from 'zod'
import { FeatureType } from './feature'

/**
 * What an entitlement can belong to.
 *
 * Plans and add-ons, in this catalogue. The wire also allows `SUBSCRIPTION`, but
 * that is set by the billing side, not authored here.
 */
export const EntitlementEntityType = {
  Plan: 'PLAN',
  Addon: 'ADDON',
} as const
export type EntitlementEntityType =
  (typeof EntitlementEntityType)[keyof typeof EntitlementEntityType]

/**
 * How often a metered allowance resets.
 *
 * `NEVER` is a lifetime allowance — the meter counts up and does not roll over.
 * The rest align to a billing period.
 */
export const UsageResetPeriod = {
  Daily: 'DAILY',
  Weekly: 'WEEKLY',
  Monthly: 'MONTHLY',
  Quarterly: 'QUARTERLY',
  HalfYearly: 'HALF_YEARLY',
  Annual: 'ANNUAL',
  Never: 'NEVER',
} as const
export type UsageResetPeriod = (typeof UsageResetPeriod)[keyof typeof UsageResetPeriod]

export const USAGE_RESET_PERIOD_LABEL: Record<UsageResetPeriod, string> = {
  [UsageResetPeriod.Daily]: 'Daily',
  [UsageResetPeriod.Weekly]: 'Weekly',
  [UsageResetPeriod.Monthly]: 'Monthly',
  [UsageResetPeriod.Quarterly]: 'Quarterly',
  [UsageResetPeriod.HalfYearly]: 'Half-yearly',
  [UsageResetPeriod.Annual]: 'Annual',
  [UsageResetPeriod.Never]: 'Never (lifetime)',
}

/**
 * An entitlement, as the plan's Entitlements tab reads it.
 *
 * `usageLimit` null means the metered feature is *unlimited* — the difference
 * between "50,000 calls" and "as many as you like", which the table must show
 * differently. The value fields are all optional because which one is meaningful
 * depends on `featureType`.
 */
export interface Entitlement {
  id: string
  featureId: string
  /** The feature's name, when the response expanded it — for the table. */
  featureName: string | null
  featureType: FeatureType
  entityType: EntitlementEntityType
  entityId: string
  /** Metered: the allowance, or null for unlimited. */
  usageLimit: number | null
  usageResetPeriod: UsageResetPeriod | null
  /** Metered: whether going over is allowed (a soft limit) or blocked. */
  isSoftLimit: boolean
  /** Static: the granted value, as a string. */
  staticValue: string | null
  /** Boolean: whether the feature is switched on. */
  isEnabled: boolean | null
  /** Config: the JSON blob, kept as sent. */
  configValue: Record<string, unknown> | null
  createdAt: Date | null
}

/**
 * The rules for granting an entitlement.
 *
 * A discriminated union on the feature type: a metered grant carries a limit and
 * a reset period, a static one a value, a boolean one a flag, a config one a
 * blob — and nothing carries a field it has no use for. `usageLimit` is a
 * `number | null` where null is a deliberate choice ("unlimited"), so the drawer
 * distinguishes an unset field from an infinite allowance.
 */
export const createEntitlementSchema = z.discriminatedUnion('featureType', [
  z.object({
    featureId: z.string().min(1, 'Choose a feature'),
    featureType: z.literal(FeatureType.Metered),
    /** null is "unlimited"; a number is the allowance. */
    usageLimit: z
      .number({ error: 'Enter a limit' })
      .int('Must be a whole number')
      .nonnegative('Cannot be negative')
      .nullable(),
    usageResetPeriod: z
      .enum([
        UsageResetPeriod.Daily,
        UsageResetPeriod.Weekly,
        UsageResetPeriod.Monthly,
        UsageResetPeriod.Quarterly,
        UsageResetPeriod.HalfYearly,
        UsageResetPeriod.Annual,
        UsageResetPeriod.Never,
      ])
      .nullable(),
    isSoftLimit: z.boolean(),
  }),
  z.object({
    featureId: z.string().min(1, 'Choose a feature'),
    featureType: z.literal(FeatureType.Static),
    staticValue: z.string().trim().min(1, 'Enter a value'),
  }),
  z.object({
    featureId: z.string().min(1, 'Choose a feature'),
    featureType: z.literal(FeatureType.Boolean),
    isEnabled: z.boolean(),
  }),
  z.object({
    featureId: z.string().min(1, 'Choose a feature'),
    featureType: z.literal(FeatureType.Config),
    /** A non-empty object; the drawer parses the editor's text into this. */
    configValue: z.record(z.string(), z.unknown()),
  }),
])

export type CreateEntitlement = z.infer<typeof createEntitlementSchema>

/**
 * A blank draft for a chosen feature type, so the drawer opens coherent.
 *
 * A metered grant defaults to a monthly reset and a hard limit (the safe
 * default — going over is blocked until someone decides otherwise); a boolean
 * grant defaults to on, since a plan that includes a feature usually enables it.
 */
export function emptyEntitlement(featureId: string, featureType: FeatureType): CreateEntitlement {
  switch (featureType) {
    case FeatureType.Metered:
      return {
        featureId,
        featureType,
        usageLimit: 0,
        usageResetPeriod: UsageResetPeriod.Monthly,
        isSoftLimit: false,
      }
    case FeatureType.Static:
      return { featureId, featureType, staticValue: '' }
    case FeatureType.Boolean:
      return { featureId, featureType, isEnabled: true }
    case FeatureType.Config:
      return { featureId, featureType, configValue: {} }
  }
}
