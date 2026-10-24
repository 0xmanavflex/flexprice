import { FilterOp, type ListFilter, type ListFilterSpec } from './listFilter'
import { z } from 'zod'
import { type AlertSettingConfig, alertSettingConfigSchema } from './alertSetting'
import { KEY_PREFIX, suggestKey } from './suggestKey'

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

export const FeatureStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type FeatureStatus = (typeof FeatureStatus)[keyof typeof FeatureStatus]

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  [FeatureStatus.Published]: 'Published',
  [FeatureStatus.Archived]: 'Archived',
}

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

/** One event filter: a property of the event and the values that let it through. */
export const meterFilterSchema = z.object({
  key: z.string().trim().min(1, 'Enter the event property'),
  values: z.array(z.string().trim().min(1, 'Enter a value')).min(1, 'Add at least one value'),
})
export type MeterFilterDraft = z.infer<typeof meterFilterSchema>

/**
 * A display unit for reporting: `reporting_value = unit_value × conversionRate`.
 * All three fields travel together — the backend rejects a partial one. The
 * rate is a decimal string, never a float.
 */
export const reportingUnitSchema = z.object({
  unitSingular: z.string().trim().min(1, 'Enter the singular unit'),
  unitPlural: z.string().trim().min(1, 'Enter the plural unit'),
  conversionRate: decimal,
})
export type ReportingUnitDraft = z.infer<typeof reportingUnitSchema>

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
    /**
     * An event property to group by before aggregating. The backend accepts it
     * only with MAX aggregation, and the refinement below says so up front.
     */
    groupBy: z.string().trim().optional(),
    /** Narrow which events count: each filter is a property and the values it may take. */
    filters: z.array(meterFilterSchema).optional(),
    resetUsage: z.enum([ResetUsage.BillingPeriod, ResetUsage.Never]),
  })
  .superRefine((meter, ctx) => {
    if (meter.groupBy && meter.aggregationType !== AggregationType.Max) {
      ctx.addIssue({
        code: 'custom',
        path: ['groupBy'],
        message: 'Group by is only available with the Maximum aggregation',
      })
    }

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
    .regex(/^[a-z0-9_-]*$/, 'Use lowercase letters, numbers, hyphens and underscores')
    .optional(),
  description: z.string().trim().optional(),
  unitSingular: z.string().trim().optional(),
  unitPlural: z.string().trim().optional(),
  /** Display unit for reports; all three of its fields or none. */
  reportingUnit: reportingUnitSchema.optional(),
  /** The group this feature is filed under. */
  groupId: z.string().trim().optional(),
  /** Usage alert thresholds for this feature. */
  alertSettings: alertSettingConfigSchema.optional(),
}

/** The backend wants a feature's own unit names as a pair, or not at all. */
function refineUnitPair(
  value: { unitSingular?: string | undefined; unitPlural?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (Boolean(value.unitSingular) !== Boolean(value.unitPlural)) {
    ctx.addIssue({
      code: 'custom',
      path: [value.unitSingular ? 'unitPlural' : 'unitSingular'],
      message: 'Enter both the singular and plural unit, or neither',
    })
  }
}

export const createFeatureSchema = z.discriminatedUnion('type', [
  z
    .object({ ...common, type: z.literal(FeatureType.Metered), meter: meterSchema })
    .superRefine(refineUnitPair),
  z.object({ ...common, type: z.literal(FeatureType.Boolean) }).superRefine(refineUnitPair),
  z.object({ ...common, type: z.literal(FeatureType.Static) }).superRefine(refineUnitPair),
  z.object({ ...common, type: z.literal(FeatureType.Config) }).superRefine(refineUnitPair),
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

/** The lookup key V1 derives from a feature's name (`feat-api-calls`). */
export function defaultFeatureLookupKey(name: string): string {
  return suggestKey(KEY_PREFIX.feature, name)
}

/**
 * What an edit can change: everything except the type, lookup key and meter,
 * which the backend treats as immutable once a feature exists. The meter's
 * event filters are the one meter property that may still change.
 *
 * A field left `undefined` is left alone on the server; `description`, the unit
 * names and `groupId` may be `''` to clear them.
 */
export const editFeatureSchema = z
  .object({
    name,
    description: z.string().trim().optional(),
    unitSingular: z.string().trim().optional(),
    unitPlural: z.string().trim().optional(),
    reportingUnit: reportingUnitSchema.optional(),
    groupId: z.string().trim().optional(),
    alertSettings: alertSettingConfigSchema.optional(),
    /** Metered features only. */
    filters: z.array(meterFilterSchema).optional(),
    /** The whole key/value map; replaces what the feature carried. */
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .superRefine(refineUnitPair)

export type EditFeature = z.infer<typeof editFeatureSchema>

/** The clone dialog: a new name and lookup key, both required and both unique. */
export const cloneFeatureSchema = z.object({
  name,
  lookupKey: z
    .string()
    .trim()
    .min(1, 'Enter a lookup key')
    .regex(/^[a-z0-9_-]+$/, 'Use lowercase letters, numbers, hyphens and underscores'),
  description: z.string().trim().optional(),
})

export type CloneFeature = z.infer<typeof cloneFeatureSchema>

/** A clone draft seeded from its source: a distinct name, and the key derived from it. */
export function emptyCloneFeature(source: { name: string; description?: string }): CloneFeature {
  const copyName = `${source.name} (copy)`
  return {
    name: copyName,
    lookupKey: defaultFeatureLookupKey(copyName),
    ...(source.description ? { description: source.description } : {}),
  }
}

/** The read model the list and detail pages render. Narrow and total. */
export interface Feature {
  id: string
  name: string
  /** Usage alert thresholds stored on the feature (`alert_settings`); null when none. */
  alertSettings?: AlertSettingConfig | null
  lookupKey: string
  description: string
  type: FeatureType
  status: FeatureStatus
  /** Present only for metered features. */
  eventName: string | null
  aggregationType: AggregationType | null
  /** The meter a metered feature bills against; null for non-metered features. */
  meterId: string | null
  unitSingular: string
  unitPlural: string
  /** The group the feature is filed under, when it has one. */
  groupId?: string | null
  /** The reporting unit, when one is set. */
  reportingUnit?: ReportingUnitDraft | null
  /** The meter's event filters (metered features only). */
  meterFilters?: MeterFilterDraft[]
  /**
   * The meter's own usage window, when it has one.
   *
   * A price may set a window of its own *only* when the meter does not: the
   * API refuses the second source rather than letting one shadow the other.
   * Carried on the read model so the charge form can say why the field is
   * unavailable instead of failing on save.
   */
  meterBucketSize?: string | null
  /** The meter's aggregation target and options, for prefilling an edit. */
  aggregationField?: string | null
  aggregationGroupBy?: string | null
  /** Free-form key/value fields, as the API returns them. */
  metadata?: Readonly<Record<string, string>>
  createdAt: Date | null
  updatedAt: Date | null
}

export const FEATURE_TYPE_LABEL: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Metered',
  [FeatureType.Boolean]: 'Boolean',
  [FeatureType.Static]: 'Static',
  [FeatureType.Config]: 'Config',
}

/** Spreadsheet names for the aggregations, as people write them in Sheets. */
const FORMULA_FUNCTION: Record<AggregationType, string> = {
  [AggregationType.Count]: 'COUNT',
  [AggregationType.CountUnique]: 'COUNTUNIQUE',
  [AggregationType.Sum]: 'SUM',
  [AggregationType.SumWithMultiplier]: 'SUM',
  [AggregationType.Avg]: 'AVERAGE',
  [AggregationType.Max]: 'MAX',
  [AggregationType.Latest]: 'LATEST',
  [AggregationType.WeightedSum]: 'WEIGHTEDSUM',
}

/**
 * A metered feature's aggregation as a formula over its event property:
 * `COUNT()`, `SUM(tokens)`, `COUNTUNIQUE(user_id)`. Null when there is no meter.
 */
export function aggregationFormula(
  feature: Pick<Feature, 'aggregationType' | 'aggregationField'>,
): string | null {
  const { aggregationType: type, aggregationField: field } = feature
  if (!type) return null
  const name = FORMULA_FUNCTION[type]
  if (!needsAggregationTarget(type)) return `${name}()`
  const target = field ?? ''
  return type === AggregationType.SumWithMultiplier
    ? `${name}(${target} * multiplier)`
    : `${name}(${target})`
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
/**
 * What the list can be ordered by.
 *
 * These five, and no more, because `/features/search` validates the sort field
 * against the feature table's own columns and answers an unknown one with
 * `400 Unknown field name '<x>' in feature query` — it does not fall back.
 *
 * Checked against the live API: `event_name` and `aggregation` are rejected
 * (they belong to the meter, not the feature) and so are `plans` and
 * `contracts` (derived counts, not columns). Sorting by any of those needs the
 * backend to support it first.
 */
export const FeatureSortField = {
  Name: 'name',
  LookupKey: 'lookupKey',
  Type: 'type',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type FeatureSortField = (typeof FeatureSortField)[keyof typeof FeatureSortField]

export const FEATURE_SORT_LABEL: Record<FeatureSortField, string> = {
  [FeatureSortField.Name]: 'Name',
  [FeatureSortField.LookupKey]: 'Key',
  [FeatureSortField.Type]: 'Type',
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
  statuses: FeatureStatus[]
  sortBy: FeatureSortField
  sortDirection: 'asc' | 'desc'
  /** Table or cards. Lives in the URL like the rest of the query. */
  view: FeatureView
  /** Granular field filters, applied by the search endpoint. See `FEATURE_FILTERS`. */
  filters?: ListFilter[]
}

/**
 * The list opens on published (active) features only, as V1 did: a visible,
 * removable "Status is Published" filter, sent to the search endpoint, so
 * archived features stay out of the list and its totals until asked for.
 */
export const ACTIVE_FEATURES_FILTER: ListFilter = {
  field: 'status',
  op: FilterOp.In,
  value: [FeatureStatus.Published],
}

export const DEFAULT_FEATURE_QUERY: FeatureQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  types: [],
  statuses: [],
  // Alphabetical, because a catalogue is looked *up* more often than it is
  // scanned for what changed.
  sortBy: FeatureSortField.UpdatedAt,
  sortDirection: 'desc',
  view: FeatureView.Table,
  filters: [ACTIVE_FEATURES_FILTER],
}

/**
 * Whether the list is narrowed beyond its default view. The default status
 * filter does not count, so an empty catalogue still gets the first-run empty
 * state rather than "nothing matches these filters".
 */
export function isFeatureQueryFiltered(query: FeatureQuery): boolean {
  return (
    query.search.length > 0 ||
    query.types.length > 0 ||
    query.statuses.length > 0 ||
    JSON.stringify(query.filters ?? []) !== JSON.stringify(DEFAULT_FEATURE_QUERY.filters ?? [])
  )
}

/** What the product list can filter on — V1's fields, by their wire names. */
export const FEATURE_FILTERS: readonly ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'lookup_key', label: 'Lookup key', kind: 'text' },
  {
    field: 'type',
    label: 'Type',
    kind: 'options',
    options: [
      { value: 'metered', label: 'Metered' },
      { value: 'boolean', label: 'Boolean' },
      { value: 'static', label: 'Static' },
      { value: 'config', label: 'Config' },
    ],
  },
  {
    field: 'status',
    label: 'Status',
    kind: 'options',
    options: [
      { value: 'published', label: 'Published' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  // The account's own feature groups; the page fills the choices in.
  { field: 'group_id', label: 'Group', kind: 'options', options: [] },
  { field: 'created_at', label: 'Created', kind: 'date' },
]
