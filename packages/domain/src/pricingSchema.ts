/**
 * A pricing schema: what the parser answers with, and what gets created.
 *
 * `POST /ai/pricing/parse-gemini` turns a description of a pricing page into
 * this shape. Nothing here is persisted: it is the plan of what *will* be
 * created, shown for review first, and only then applied as features, plans,
 * prices, entitlements and credit grants.
 *
 * The model is told the shape (see `pricingPrompt.ts`) but a model is not a
 * schema validator, so what comes back is parsed rather than trusted:
 * `normalisePricingSchema` fills the defaults V1's normaliser filled, and
 * `pricingSchemaProblems` reports what could not be created and why, so the
 * review screen can say so instead of failing halfway through.
 */

export type PricingFeatureType = 'static' | 'metered'
export type PricingAggregation = 'count' | 'sum'
export type PricingBillingPeriod = 'monthly' | 'annual' | 'one_time'
export type PricingBillingModel = 'flat_fee' | 'package'
export type PricingCadence = 'onetime' | 'recurring'

export interface PricingFeature {
  name: string
  key: string
  type: PricingFeatureType
  unitSingular: string
  unitPlural: string
  /** The ingestion event name; defaults to the key when the model omits it. */
  eventName: string
  /** Metered only. COUNT is one event one unit; SUM adds up a property. */
  aggregation: PricingAggregation
  /** Required by SUM: the property on the event payload to add up. */
  aggregationField: string | null
}

export interface PricingEntitlement {
  featureKey: string
  isUnlimited: boolean
  /** Null when unlimited. */
  value: number | null
}

export interface PricingPrice {
  /** Main currency units: $20/month is 20, not 2000. */
  amount: number
  currency: string
  billingPeriod: PricingBillingPeriod
}

export interface PricingUsageCharge {
  featureKey: string
  amountPerUnit: number
  currency: string
  billingPeriod: 'monthly' | 'annual'
  billingModel: PricingBillingModel
  /** Required by package billing: how many units one package is. */
  packageSize: number | null
  displayName: string | null
}

export interface PricingPlan {
  name: string
  description: string
  prices: PricingPrice[]
  entitlements: PricingEntitlement[]
  usageCharges: PricingUsageCharge[]
}

export interface PricingCreditGrant {
  planName: string
  name: string
  credits: number
  cadence: PricingCadence
  period: 'monthly' | 'annual' | null
  /**
   * What one credit is worth in the plan's currency (1 credit = $0.01 is
   * 0.01), or null when the grant does not say. Sent with the grant, as V1 did.
   */
  conversionRate: number | null
}

export interface PricingSchema {
  features: PricingFeature[]
  plans: PricingPlan[]
  creditGrants: PricingCreditGrant[]
}

/** Marks everything this flow creates, so it can be told apart later. */
export const AI_SETUP_METADATA: Record<string, string> = { created_with_ai: 'true' }

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** A recurring grant repeats on a period; a one-time grant has none. */
function grantPeriod(cadence: PricingCadence, raw: string): 'monthly' | 'annual' | null {
  if (cadence !== 'recurring') return null
  return raw === 'annual' ? 'annual' : 'monthly'
}

function billingPeriod(value: unknown): PricingBillingPeriod {
  const raw = str(value, 'monthly').toLowerCase()
  return raw === 'annual' || raw === 'one_time' ? raw : 'monthly'
}

/**
 * The wire body, in whatever state the model left it, as a schema.
 *
 * Snake_case in, camelCase out: the rest of the console speaks camelCase and
 * the boundary is here, not in the screen. Missing lists become empty ones and
 * a missing currency becomes USD, which is what V1's normaliser did; anything
 * that cannot be defaulted is left for `pricingSchemaProblems` to report.
 */
export function normalisePricingSchema(wire: unknown): PricingSchema {
  const body = (wire ?? {}) as Record<string, unknown>

  const features: PricingFeature[] = list(body['features']).map((raw) => {
    const f = raw as Record<string, unknown>
    const key = str(f['key'])
    const type: PricingFeatureType =
      str(f['type']).toLowerCase() === 'metered' ? 'metered' : 'static'
    const aggregation: PricingAggregation =
      str(f['aggregation']).toLowerCase() === 'sum' ? 'sum' : 'count'
    return {
      name: str(f['name'], key),
      key,
      type,
      unitSingular: str(f['unit_singular'], 'unit'),
      unitPlural: str(f['unit_plural'], 'units'),
      // V1: an omitted event name defaults to the key.
      eventName: str(f['meter_event_name'], key),
      aggregation,
      aggregationField: aggregation === 'sum' ? str(f['aggregation_field']) || null : null,
    }
  })

  const known = new Map(features.map((feature) => [feature.key, feature.type]))

  const plans: PricingPlan[] = list(body['plans']).map((raw) => {
    const p = raw as Record<string, unknown>
    return {
      name: str(p['name'], 'Untitled plan'),
      description: str(p['description']),
      prices: list(p['prices']).map((rawPrice) => {
        const price = rawPrice as Record<string, unknown>
        return {
          amount: num(price['amount']) ?? 0,
          currency: str(price['currency'], 'USD').toUpperCase(),
          billingPeriod: billingPeriod(price['billing_period']),
        }
      }),
      entitlements: list(p['entitlements'])
        .map((rawEnt) => {
          const e = rawEnt as Record<string, unknown>
          const isUnlimited = e['is_unlimited'] === true
          return {
            featureKey: str(e['feature_key']),
            isUnlimited,
            value: isUnlimited ? null : num(e['value']),
          }
        })
        // An entitlement naming a feature the schema does not define cannot be
        // created; dropping it here keeps the review honest about what will be.
        .filter((e) => known.has(e.featureKey)),
      usageCharges: list(p['usage_charges'])
        .map((rawCharge) => {
          const c = rawCharge as Record<string, unknown>
          const model: PricingBillingModel =
            str(c['billing_model']).toLowerCase() === 'package' ? 'package' : 'flat_fee'
          const period = billingPeriod(c['billing_period'])
          return {
            featureKey: str(c['feature_key']),
            amountPerUnit: num(c['amount_per_unit']) ?? 0,
            currency: str(c['currency'], 'USD').toUpperCase(),
            // A usage charge cannot be one-time; the model is told so, but it
            // is cheaper to coerce than to reject the whole schema over it.
            billingPeriod: (period === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual',
            billingModel: model,
            packageSize: model === 'package' ? num(c['package_size']) : null,
            displayName: str(c['display_name']) || null,
          }
        })
        .filter((c) => known.get(c.featureKey) === 'metered'),
    }
  })

  const planNames = new Set(plans.map((plan) => plan.name))

  return {
    features,
    plans,
    creditGrants: list(body['credit_grants'])
      .map((raw) => {
        const g = raw as Record<string, unknown>
        const cadence: PricingCadence =
          str(g['cadence']).toLowerCase() === 'recurring' ? 'recurring' : 'onetime'
        const period = str(g['period']).toLowerCase()
        const rate = num(g['conversion_rate'])
        return {
          planName: str(g['plan_name']),
          name: str(g['name'], 'Credits'),
          credits: num(g['credits']) ?? 0,
          cadence,
          period: grantPeriod(cadence, period),
          conversionRate: rate !== null && rate > 0 ? rate : null,
        }
      })
      .filter((grant) => planNames.has(grant.planName)),
  }
}

/** Rounds away float noise (0.078 * 0.01 is 0.0007800000000000001). */
function tidy(amount: number): number {
  return Number(amount.toPrecision(12))
}

/**
 * The schema with each credit-priced usage rate turned into its currency amount.
 *
 * For a schema whose usage rates are written in credits (the Railway, Apollo
 * and Vapi templates: "hosting is 5 credits a minute"), while prices are
 * created in currency. A plan's rates are converted with its own grant's rate,
 * so Vapi's 5 credits at 1 credit = $0.01 becomes $0.05 a minute, which the
 * wallet then debits as 5 credits. A plan with no grant that names a rate is
 * left as it is. Only the templates go through this; a parse is created as
 * the model wrote it.
 */
export function creditRatesToCurrency(schema: PricingSchema): PricingSchema {
  const rates = new Map<string, number>()
  for (const grant of schema.creditGrants) {
    if (grant.conversionRate !== null && !rates.has(grant.planName)) {
      rates.set(grant.planName, grant.conversionRate)
    }
  }
  return {
    ...schema,
    plans: schema.plans.map((plan) => {
      const rate = rates.get(plan.name)
      if (rate === undefined) return plan
      return {
        ...plan,
        usageCharges: plan.usageCharges.map((charge) => ({
          ...charge,
          amountPerUnit: tidy(charge.amountPerUnit * rate),
        })),
      }
    }),
  }
}

/**
 * What in this schema cannot be created, in words.
 *
 * Returned rather than thrown: the review screen lists the problems beside the
 * plan so they can be seen before anything is written, which is the whole
 * reason the schema is reviewed rather than applied straight off the parse.
 */
export function pricingSchemaProblems(schema: PricingSchema): string[] {
  const problems: string[] = []

  if (schema.features.length === 0 && schema.plans.length === 0) {
    problems.push('Nothing was recognised in that description.')
  }

  const seen = new Set<string>()
  for (const feature of schema.features) {
    if (!feature.key) {
      problems.push(`The feature "${feature.name}" has no key.`)
      continue
    }
    if (seen.has(feature.key)) problems.push(`Two features share the key "${feature.key}".`)
    seen.add(feature.key)
    if (feature.type === 'metered' && feature.aggregation === 'sum' && !feature.aggregationField) {
      problems.push(`"${feature.name}" sums usage but names no field to sum.`)
    }
  }

  const planNames = new Set<string>()
  for (const plan of schema.plans) {
    if (planNames.has(plan.name)) problems.push(`Two plans are both called "${plan.name}".`)
    planNames.add(plan.name)
    for (const charge of plan.usageCharges) {
      if (charge.billingModel === 'package' && !charge.packageSize) {
        problems.push(`A package charge on "${plan.name}" does not say how big a package is.`)
      }
    }
  }

  return problems
}

/** How many records applying this schema would create. */
export function pricingSchemaTotals(schema: PricingSchema): {
  features: number
  plans: number
  prices: number
  entitlements: number
  creditGrants: number
} {
  return {
    features: schema.features.length,
    plans: schema.plans.length,
    prices: schema.plans.reduce(
      (sum, plan) => sum + plan.prices.length + plan.usageCharges.length,
      0,
    ),
    entitlements: schema.plans.reduce((sum, plan) => sum + plan.entitlements.length, 0),
    creditGrants: schema.creditGrants.length,
  }
}
