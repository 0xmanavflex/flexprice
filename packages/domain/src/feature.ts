import { z } from 'zod'

/**
 * A feature, and the rules for creating one.
 *
 * V1's `AddFeature.tsx` is 1,106 lines — the second-largest file in the
 * dashboard — and the rules below are spread across a bespoke `useFeatureForm`
 * hook, two separate validator callbacks, and conditional rendering. The shape
 * is really two nested discriminated unions: the feature type decides whether
 * a meter exists at all, and the aggregation type decides which meter fields
 * are required.
 *
 * Written as one schema, "is this valid" has a single answer, and it is the
 * same answer whether a person or an agent is asking.
 */

export const FeatureType = {
  /** Usage is measured from events, so it needs a meter. */
  Metered: 'metered',
  /** On or off for a plan. */
  Boolean: 'boolean',
  /** A fixed quantity, e.g. 10 seats. */
  Static: 'static',
  /** A configuration value carried on the plan. */
  Config: 'config',
} as const
export type FeatureType = (typeof FeatureType)[keyof typeof FeatureType]

export const AggregationType = {
  Count: 'COUNT',
  CountUnique: 'COUNT_UNIQUE',
  Sum: 'SUM',
  SumWithMultiplier: 'SUM_WITH_MULTIPLIER',
  Avg: 'AVG',
  Max: 'MAX',
  Latest: 'LATEST',
  WeightedSum: 'WEIGHTED_SUM',
} as const
export type AggregationType = (typeof AggregationType)[keyof typeof AggregationType]

export const ResetUsage = {
  BillingPeriod: 'BILLING_PERIOD',
  Never: 'NEVER',
} as const
export type ResetUsage = (typeof ResetUsage)[keyof typeof ResetUsage]

/** COUNT is the only aggregation that needs nothing per event to add up. */
export function needsAggregationTarget(type: AggregationType): boolean {
  return type !== AggregationType.Count
}

const decimal = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Enter a number, for example 1.5')
  .refine((v) => Number.parseFloat(v) > 0, 'Must be greater than zero')

const name = z.string().trim().min(1, 'Enter a name')

/**
 * A meter, with the rules that depend on how it aggregates.
 *
 * `field` and `expression` are two ways of saying the same thing — which
 * property of the event to aggregate — and exactly one is needed. V1 decides
 * which to validate by reading a `showCustomExpression` boolean out of form
 * state, which means the rule cannot be checked outside the form. Here either
 * satisfies it, so the rule holds wherever it is applied.
 */
export const meterSchema = z
  .object({
    eventName: z.string().trim().min(1, 'Enter the event name'),
    aggregationType: z.enum(
      Object.values(AggregationType) as [AggregationType, ...AggregationType[]],
    ),
    /** The event property to aggregate. */
    field: z.string().trim().optional(),
    /** An expression over the event, as an alternative to a single field. */
    expression: z.string().trim().optional(),
    /** Only for SUM_WITH_MULTIPLIER. A decimal string — never a float. */
    multiplier: z.string().trim().optional(),
    resetUsage: z.enum([ResetUsage.BillingPeriod, ResetUsage.Never]),
  })
  .superRefine((meter, ctx) => {
    if (needsAggregationTarget(meter.aggregationType) && !meter.field && !meter.expression) {
      ctx.addIssue({
        code: 'custom',
        path: ['field'],
        message: 'This aggregation needs an event field or an expression',
      })
    }

    if (meter.aggregationType === AggregationType.SumWithMultiplier) {
      const result = decimal.safeParse(meter.multiplier ?? '')
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['multiplier'],
          // V1 compares this string against 0 with `<=`, which is always false
          // for a string — so a zero multiplier passes validation there.
          message: result.error.issues[0]?.message ?? 'Enter a multiplier greater than zero',
        })
      }
    }
  })

export type MeterDraft = z.infer<typeof meterSchema>

const common = {
  name,
  /** Stable key used by the API and by customers' integrations. */
  lookupKey: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores')
    .optional(),
  description: z.string().trim().optional(),
  unitSingular: z.string().trim().optional(),
  unitPlural: z.string().trim().optional(),
}

export const createFeatureSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal(FeatureType.Metered), meter: meterSchema }),
  z.object({ ...common, type: z.literal(FeatureType.Boolean) }),
  z.object({ ...common, type: z.literal(FeatureType.Static) }),
  z.object({ ...common, type: z.literal(FeatureType.Config) }),
])

export type CreateFeature = z.infer<typeof createFeatureSchema>

/** A starting value per type, so switching type never lands on invalid state. */
export function emptyFeature(type: FeatureType): CreateFeature {
  const base = { name: '', lookupKey: '', description: '' }
  if (type === FeatureType.Metered) {
    return {
      ...base,
      type,
      meter: {
        eventName: '',
        aggregationType: AggregationType.Count,
        resetUsage: ResetUsage.BillingPeriod,
      },
    }
  }
  return { ...base, type }
}

/** The read model the list and detail pages render. Narrow and total. */
export interface Feature {
  id: string
  name: string
  lookupKey: string
  description: string
  type: FeatureType
  /** Present only for metered features. */
  eventName: string | null
  aggregationType: AggregationType | null
  unitSingular: string
  unitPlural: string
  createdAt: Date | null
}

export const FEATURE_TYPE_LABEL: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Metered',
  [FeatureType.Boolean]: 'Boolean',
  [FeatureType.Static]: 'Static',
  [FeatureType.Config]: 'Config',
}

export const AGGREGATION_LABEL: Record<AggregationType, string> = {
  [AggregationType.Count]: 'Count of events',
  [AggregationType.CountUnique]: 'Count of unique values',
  [AggregationType.Sum]: 'Sum of a field',
  [AggregationType.SumWithMultiplier]: 'Sum, multiplied',
  [AggregationType.Avg]: 'Average of a field',
  [AggregationType.Max]: 'Maximum value',
  [AggregationType.Latest]: 'Most recent value',
  [AggregationType.WeightedSum]: 'Weighted sum',
}

/**
 * What the list can be sorted by.
 *
 * The three the API's `sort` accepts and a person would ask for. Named in
 * product terms, mapped to wire field names in `@fp/query` — a screen should
 * never have to know that "Created" is `created_at`.
 */
export const FeatureSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type FeatureSortField = (typeof FeatureSortField)[keyof typeof FeatureSortField]

export const FEATURE_SORT_LABEL: Record<FeatureSortField, string> = {
  [FeatureSortField.Name]: 'Name',
  [FeatureSortField.CreatedAt]: 'Created',
  [FeatureSortField.UpdatedAt]: 'Updated',
}

/**
 * How the list is laid out. `table` for scanning many rows, `cards` for reading
 * each feature's detail at a glance. A layout, not a filter — it changes nothing
 * about which features are fetched, so `@fp/query` keeps it out of the cache key.
 */
export const FeatureView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type FeatureView = (typeof FeatureView)[keyof typeof FeatureView]

/** What the list can ask for. Product vocabulary, not transport. */
export interface FeatureQuery {
  page: number
  pageSize: number
  search: string
  types: FeatureType[]
  sortBy: FeatureSortField
  sortDirection: 'asc' | 'desc'
  /** Table or cards. Lives in the URL like the rest of the query. */
  view: FeatureView
}

export const DEFAULT_FEATURE_QUERY: FeatureQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  types: [],
  // Alphabetical, because a catalogue is looked *up* more often than it is
  // scanned for what changed.
  sortBy: FeatureSortField.Name,
  sortDirection: 'asc',
  view: FeatureView.Table,
}
