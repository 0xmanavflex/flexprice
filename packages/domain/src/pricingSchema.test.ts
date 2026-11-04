import { describe, expect, it } from 'vitest'
import {
  creditRatesToCurrency,
  normalisePricingSchema,
  pricingSchemaProblems,
  pricingSchemaTotals,
} from './pricingSchema'

/** A minimal wire body in the shape the parser answers with. */
const WIRE = {
  features: [
    {
      name: 'API Calls',
      key: 'api_calls',
      type: 'metered',
      unit_singular: 'call',
      unit_plural: 'calls',
      aggregation: 'count',
    },
  ],
  plans: [
    {
      name: 'Starter',
      description: 'Entry tier',
      prices: [{ amount: 29, currency: 'usd', billing_period: 'monthly' }],
      entitlements: [{ feature_key: 'api_calls', is_unlimited: false, value: 10000 }],
      usage_charges: [
        {
          feature_key: 'api_calls',
          amount_per_unit: 0.01,
          currency: 'usd',
          billing_period: 'monthly',
        },
      ],
    },
  ],
  credit_grants: [
    { plan_name: 'Starter', name: 'Welcome credits', credits: 5000, cadence: 'onetime' },
  ],
}

describe('normalisePricingSchema', () => {
  it('reads the wire body into the console’s own shape', () => {
    const schema = normalisePricingSchema(WIRE)
    expect(schema.features[0]).toMatchObject({
      key: 'api_calls',
      type: 'metered',
      unitSingular: 'call',
      aggregation: 'count',
    })
    expect(schema.plans[0]?.prices[0]).toEqual({
      amount: 29,
      currency: 'USD',
      billingPeriod: 'monthly',
    })
    expect(schema.creditGrants[0]).toMatchObject({ planName: 'Starter', credits: 5000 })
  })

  it('defaults an omitted event name to the feature key, as V1 does', () => {
    expect(normalisePricingSchema(WIRE).features[0]?.eventName).toBe('api_calls')
    const named = normalisePricingSchema({
      ...WIRE,
      features: [{ ...WIRE.features[0], meter_event_name: 'api.calls' }],
    })
    expect(named.features[0]?.eventName).toBe('api.calls')
  })

  it('survives a body with nothing in it', () => {
    for (const empty of [null, undefined, {}, 'nonsense', 42]) {
      const schema = normalisePricingSchema(empty)
      expect(schema).toEqual({ features: [], plans: [], creditGrants: [] })
    }
  })

  it('drops an entitlement for a feature the schema never defines', () => {
    const schema = normalisePricingSchema({
      ...WIRE,
      plans: [
        {
          ...WIRE.plans[0],
          entitlements: [
            { feature_key: 'api_calls', is_unlimited: true, value: null },
            { feature_key: 'ghost', is_unlimited: false, value: 5 },
          ],
        },
      ],
    })
    expect(schema.plans[0]?.entitlements).toHaveLength(1)
    expect(schema.plans[0]?.entitlements[0]).toMatchObject({ isUnlimited: true, value: null })
  })

  it('drops a usage charge that is not against a metered feature', () => {
    const schema = normalisePricingSchema({
      features: [{ name: 'SSO', key: 'sso', type: 'static' }],
      plans: [
        {
          name: 'Starter',
          prices: [],
          entitlements: [],
          usage_charges: [{ feature_key: 'sso', amount_per_unit: 1, currency: 'USD' }],
        },
      ],
    })
    expect(schema.plans[0]?.usageCharges).toHaveLength(0)
  })

  it('drops a credit grant naming a plan that does not exist', () => {
    const schema = normalisePricingSchema({
      ...WIRE,
      credit_grants: [{ plan_name: 'Nowhere', name: 'Credits', credits: 10, cadence: 'onetime' }],
    })
    expect(schema.creditGrants).toHaveLength(0)
  })

  it('gives a recurring grant a period and a one-time grant none', () => {
    const schema = normalisePricingSchema({
      ...WIRE,
      credit_grants: [
        { plan_name: 'Starter', name: 'Monthly', credits: 10, cadence: 'recurring' },
        { plan_name: 'Starter', name: 'Once', credits: 10, cadence: 'onetime', period: 'annual' },
      ],
    })
    expect(schema.creditGrants[0]).toMatchObject({ cadence: 'recurring', period: 'monthly' })
    expect(schema.creditGrants[1]).toMatchObject({ cadence: 'onetime', period: null })
  })

  it("keeps a grant's conversion rate, and a parse's usage rates as written", () => {
    const wire = {
      ...WIRE,
      credit_grants: [
        {
          plan_name: 'Starter',
          name: 'Rated',
          credits: 10,
          cadence: 'onetime',
          conversion_rate: 0.01,
        },
      ],
    }
    const schema = normalisePricingSchema(wire)
    expect(schema.creditGrants[0]?.conversionRate).toBe(0.01)
    expect(schema.plans[0]?.usageCharges[0]?.amountPerUnit).toBe(
      normalisePricingSchema(WIRE).plans[0]?.usageCharges[0]?.amountPerUnit,
    )
    const unrated = normalisePricingSchema({
      ...WIRE,
      credit_grants: [
        { plan_name: 'Starter', name: 'Free', credits: 10, cadence: 'onetime', conversion_rate: 0 },
      ],
    })
    expect(unrated.creditGrants[0]?.conversionRate).toBeNull()
  })

  it('converts credit-priced usage rates with the plan grant rate', () => {
    const schema = creditRatesToCurrency(
      normalisePricingSchema({
        ...WIRE,
        credit_grants: [
          {
            plan_name: 'Starter',
            name: 'Rated',
            credits: 10,
            cadence: 'onetime',
            conversion_rate: 0.01,
          },
        ],
      }),
    )
    const original = normalisePricingSchema(WIRE).plans[0]?.usageCharges[0]?.amountPerUnit ?? NaN
    expect(schema.plans[0]?.usageCharges[0]?.amountPerUnit).toBeCloseTo(original * 0.01, 12)
    // No grant with a rate: nothing to convert with.
    expect(creditRatesToCurrency(normalisePricingSchema(WIRE))).toEqual(
      normalisePricingSchema(WIRE),
    )
  })

  it('coerces a usage charge away from one-time, which it cannot be', () => {
    const schema = normalisePricingSchema({
      ...WIRE,
      plans: [
        {
          ...WIRE.plans[0],
          usage_charges: [
            {
              feature_key: 'api_calls',
              amount_per_unit: 1,
              currency: 'USD',
              billing_period: 'one_time',
            },
          ],
        },
      ],
    })
    expect(schema.plans[0]?.usageCharges[0]?.billingPeriod).toBe('monthly')
  })

  it('keeps package size only for package billing', () => {
    const schema = normalisePricingSchema({
      ...WIRE,
      plans: [
        {
          ...WIRE.plans[0],
          usage_charges: [
            {
              feature_key: 'api_calls',
              amount_per_unit: 2,
              currency: 'USD',
              billing_model: 'package',
              package_size: 1000,
            },
            {
              feature_key: 'api_calls',
              amount_per_unit: 2,
              currency: 'USD',
              package_size: 1000,
            },
          ],
        },
      ],
    })
    expect(schema.plans[0]?.usageCharges[0]).toMatchObject({
      billingModel: 'package',
      packageSize: 1000,
    })
    expect(schema.plans[0]?.usageCharges[1]).toMatchObject({
      billingModel: 'flat_fee',
      packageSize: null,
    })
  })
})

describe('pricingSchemaProblems', () => {
  it('is silent on a schema that can be created', () => {
    expect(pricingSchemaProblems(normalisePricingSchema(WIRE))).toEqual([])
  })

  it('says so when the description produced nothing', () => {
    expect(pricingSchemaProblems(normalisePricingSchema({}))).toEqual([
      'Nothing was recognised in that description.',
    ])
  })

  it('catches a SUM feature with no field to sum', () => {
    const schema = normalisePricingSchema({
      features: [{ name: 'Minutes', key: 'minutes', type: 'metered', aggregation: 'sum' }],
      plans: [{ name: 'A', prices: [], entitlements: [] }],
    })
    expect(pricingSchemaProblems(schema)).toContain(
      '"Minutes" sums usage but names no field to sum.',
    )
  })

  it('catches duplicate keys and duplicate plan names', () => {
    const schema = normalisePricingSchema({
      features: [
        { name: 'A', key: 'dup', type: 'static' },
        { name: 'B', key: 'dup', type: 'static' },
      ],
      plans: [
        { name: 'Same', prices: [], entitlements: [] },
        { name: 'Same', prices: [], entitlements: [] },
      ],
    })
    expect(pricingSchemaProblems(schema)).toEqual([
      'Two features share the key "dup".',
      'Two plans are both called "Same".',
    ])
  })

  it('catches a package charge with no package size', () => {
    const schema = normalisePricingSchema({
      features: [{ name: 'Tokens', key: 'tokens', type: 'metered' }],
      plans: [
        {
          name: 'A',
          prices: [],
          entitlements: [],
          usage_charges: [{ feature_key: 'tokens', amount_per_unit: 2, billing_model: 'package' }],
        },
      ],
    })
    expect(pricingSchemaProblems(schema)).toContain(
      'A package charge on "A" does not say how big a package is.',
    )
  })
})

describe('pricingSchemaTotals', () => {
  it('counts what applying the schema would create', () => {
    expect(pricingSchemaTotals(normalisePricingSchema(WIRE))).toEqual({
      features: 1,
      plans: 1,
      // One fixed price plus one usage charge.
      prices: 2,
      entitlements: 1,
      creditGrants: 1,
    })
  })
})
