/**
 * An entitlement, as a plan's detail page reads it, plus the rules for granting
 * one.
 *
 * An entitlement is what a plan *includes* of a feature: the metered allowance
 * ("50,000 API calls a month"), the flag that a boolean feature is on, the value
 * of a static one, or a config blob. Like charges and credit grants, it does not
 * live on the plan record: it is a separate `/entitlements/*` record tagged with
 * the plan (or add-on) it belongs to, and created in bulk.
 *
 * The feature's *type* decides the whole shape: a metered entitlement has a
 * limit and a reset period, a boolean one has neither: so the schema is a
 * discriminated union on it, and the drawer renders exactly the fields the
 * chosen feature needs.
 */
import { z } from 'zod'
import { FeatureType } from './feature'

/**
 * What an entitlement can belong to.
 *
 * Plans and add-ons in the catalogue, and a single subscription when a contract
 * is given something its plan does not carry.
 */
export const EntitlementEntityType = {
  Plan: 'PLAN',
  Addon: 'ADDON',
  Subscription: 'SUBSCRIPTION',
} as const
export type EntitlementEntityType =
  (typeof EntitlementEntityType)[keyof typeof EntitlementEntityType]

/**
 * How often a metered allowance resets.
 *
 * `NEVER` is a lifetime allowance: the meter counts up and does not roll over.
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
 * `usageLimit` null means the metered feature is *unlimited*: the difference
 * between "50,000 calls" and "as many as you like", which the table must show
 * differently. The value fields are all optional because which one is meaningful
 * depends on `featureType`.
 */
export const EntitlementGrantMeasure = { Quantity: 'quantity', Amount: 'amount' } as const
export type EntitlementGrantMeasure =
  (typeof EntitlementGrantMeasure)[keyof typeof EntitlementGrantMeasure]

export const EntitlementGrantDurationUnit = {
  Hour: 'hour',
  Day: 'day',
  Week: 'week',
  SubscriptionPeriod: 'subscription_period',
} as const
export type EntitlementGrantDurationUnit =
  (typeof EntitlementGrantDurationUnit)[keyof typeof EntitlementGrantDurationUnit]

export const EntitlementGrantAllocationBehavior = {
  FirstUsage: 'first_usage',
  UnitStart: 'unit_start',
} as const
export type EntitlementGrantAllocationBehavior =
  (typeof EntitlementGrantAllocationBehavior)[keyof typeof EntitlementGrantAllocationBehavior]

export const EntitlementAggregationMode = { Additive: 'additive', Parallel: 'parallel' } as const
export type EntitlementAggregationMode =
  (typeof EntitlementAggregationMode)[keyof typeof EntitlementAggregationMode]

export interface Entitlement {
  id: string
  featureId: string
  /** The feature's name, when the response expanded it: for the table. */
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
  /** Grant config, when the entitlement carries one. */
  grantQuota?: string | null
  grantMeasure?: EntitlementGrantMeasure | null
  grantDurationUnit?: EntitlementGrantDurationUnit | null
  grantDurationValue?: number | null
  grantAllocationBehavior?: EntitlementGrantAllocationBehavior | null
  aggregationMode?: EntitlementAggregationMode | null
  createdAt: Date | null
}

/**
 * The rules for granting an entitlement.
 *
 * A discriminated union on the feature type: a metered grant carries a limit and
 * a reset period, a static one a value, a boolean one a flag, a config one a
 * blob: and nothing carries a field it has no use for. `usageLimit` is a
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
 * default: going over is blocked until someone decides otherwise); a boolean
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

/**
 * What an entitlement edit can change.
 *
 * The backend patches: a field left `undefined` is left alone. The feature and
 * the plan or add-on it belongs to are not editable: to point a grant at a
 * different feature, delete it and add another: so they are not in this shape.
 * Only the fields for the entitlement's feature type are meaningful, and the
 * form shows only those; the schema does not have to re-state the type.
 *
 * `usageLimit` cannot be cleared back to "unlimited" through an update (the
 * request has no way to say null); that is a delete-and-recreate.
 * `clearGrantConfig` wipes the grant block back to a plain entitlement.
 */
export const editEntitlementSchema = z
  .object({
    usageLimit: z
      .number({ error: 'Enter a limit' })
      .int('Must be a whole number')
      .nonnegative('Cannot be negative')
      .optional(),
    usageResetPeriod: z
      .enum(Object.values(UsageResetPeriod) as [UsageResetPeriod, ...UsageResetPeriod[]])
      .optional(),
    isSoftLimit: z.boolean().optional(),
    staticValue: z.string().trim().min(1, 'Enter a value').optional(),
    isEnabled: z.boolean().optional(),
    configValue: z.record(z.string(), z.unknown()).optional(),
    /** A decimal string, like every other amount. */
    grantQuota: z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/, 'Enter a number, for example 100')
      .optional(),
    grantMeasure: z
      .enum(
        Object.values(EntitlementGrantMeasure) as [
          EntitlementGrantMeasure,
          ...EntitlementGrantMeasure[],
        ],
      )
      .optional(),
    grantDurationUnit: z
      .enum(
        Object.values(EntitlementGrantDurationUnit) as [
          EntitlementGrantDurationUnit,
          ...EntitlementGrantDurationUnit[],
        ],
      )
      .optional(),
    grantDurationValue: z.number().int().positive('Must be greater than zero').optional(),
    grantAllocationBehavior: z
      .enum(
        Object.values(EntitlementGrantAllocationBehavior) as [
          EntitlementGrantAllocationBehavior,
          ...EntitlementGrantAllocationBehavior[],
        ],
      )
      .optional(),
    aggregationMode: z
      .enum(
        Object.values(EntitlementAggregationMode) as [
          EntitlementAggregationMode,
          ...EntitlementAggregationMode[],
        ],
      )
      .optional(),
    clearGrantConfig: z.boolean().optional(),
  })
  .superRefine((edit, ctx) => {
    const hasGrantField =
      edit.grantQuota !== undefined ||
      edit.grantMeasure !== undefined ||
      edit.grantDurationUnit !== undefined ||
      edit.grantDurationValue !== undefined ||
      edit.grantAllocationBehavior !== undefined
    if (edit.clearGrantConfig && hasGrantField) {
      ctx.addIssue({
        code: 'custom',
        path: ['clearGrantConfig'],
        message: 'Clearing the grant config cannot be combined with changing it',
      })
    }
    if (
      edit.grantDurationUnit !== undefined &&
      edit.grantDurationUnit !== EntitlementGrantDurationUnit.SubscriptionPeriod &&
      edit.grantDurationValue === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['grantDurationValue'],
        message: 'Enter how long the grant lasts',
      })
    }
  })

export type EditEntitlement = z.infer<typeof editEntitlementSchema>

/** An edit draft seeded from an existing entitlement, so the form opens on its values. */
export function entitlementToEdit(entitlement: Entitlement): EditEntitlement {
  return {
    ...(entitlement.usageLimit !== null ? { usageLimit: entitlement.usageLimit } : {}),
    ...(entitlement.usageResetPeriod ? { usageResetPeriod: entitlement.usageResetPeriod } : {}),
    isSoftLimit: entitlement.isSoftLimit,
    ...(entitlement.staticValue !== null ? { staticValue: entitlement.staticValue } : {}),
    ...(entitlement.isEnabled !== null ? { isEnabled: entitlement.isEnabled } : {}),
    ...(entitlement.configValue ? { configValue: entitlement.configValue } : {}),
    ...(entitlement.grantQuota ? { grantQuota: entitlement.grantQuota } : {}),
    ...(entitlement.grantMeasure ? { grantMeasure: entitlement.grantMeasure } : {}),
    ...(entitlement.grantDurationUnit ? { grantDurationUnit: entitlement.grantDurationUnit } : {}),
    ...(entitlement.grantDurationValue != null
      ? { grantDurationValue: entitlement.grantDurationValue }
      : {}),
    ...(entitlement.grantAllocationBehavior
      ? { grantAllocationBehavior: entitlement.grantAllocationBehavior }
      : {}),
    ...(entitlement.aggregationMode ? { aggregationMode: entitlement.aggregationMode } : {}),
  }
}
