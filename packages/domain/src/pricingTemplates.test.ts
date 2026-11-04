import { describe, expect, it } from 'vitest'
import {
  PRICING_TEMPLATE_SCHEMAS,
  type PricingTemplateId,
  pricingTemplateSchema,
} from './pricingTemplates'
import { type PricingSchema, normalisePricingSchema, pricingSchemaProblems } from './pricingSchema'

/** The rate a plan's usage charge for a feature will be created at. */
function rate(schema: PricingSchema, plan: string, featureKey: string): number | undefined {
  return schema.plans
    .find((p) => p.name === plan)
    ?.usageCharges.find((c) => c.featureKey === featureKey)?.amountPerUnit
}

function grantRate(schema: PricingSchema, plan: string): number | null | undefined {
  return schema.creditGrants.find((g) => g.planName === plan)?.conversionRate
}

describe('the Create with AI templates', () => {
  it.each(Object.keys(PRICING_TEMPLATE_SCHEMAS) as PricingTemplateId[])(
    '%s normalises into a schema that can be created as it is',
    (id) => {
      const schema = pricingTemplateSchema(id)
      expect(schema.features.length).toBeGreaterThan(0)
      expect(schema.plans.length).toBeGreaterThan(0)
      expect(pricingSchemaProblems(schema)).toEqual([])
    },
  )

  it('vapi hosting normalises to 0.05 USD per minute and 0.005 USD per message', () => {
    const schema = pricingTemplateSchema('vapi')
    const plan = 'Vapi Pay As You Go'
    expect(rate(schema, plan, 'vapi_hosting_call_minutes')).toBe(0.05)
    expect(rate(schema, plan, 'vapi_hosting_sms_messages')).toBe(0.005)
    expect(schema.plans[0]?.usageCharges[0]?.currency).toBe('USD')
    expect(grantRate(schema, plan)).toBe(0.01)
    expect(schema.creditGrants[0]?.credits).toBe(1000)
  })

  it('railway converts every plan at 1 credit = $0.01', () => {
    const schema = pricingTemplateSchema('railway')
    for (const plan of ['Free', 'Hobby', 'Pro']) {
      expect(grantRate(schema, plan)).toBe(0.01)
      expect(rate(schema, plan, 'memory_gb_hours')).toBe(0.0004)
      expect(rate(schema, plan, 'cpu_vcpu_hours')).toBe(0.00078)
      expect(rate(schema, plan, 'egress_gb')).toBe(0.05)
      expect(rate(schema, plan, 'storage_gb_months')).toBe(0.015)
    }
  })

  it('apollo converts each plan at its own grant rate', () => {
    const wire = normalisePricingSchema(PRICING_TEMPLATE_SCHEMAS.apollo)
    const schema = pricingTemplateSchema('apollo')
    expect(schema.plans.map((p) => p.name)).toEqual(['Starter', 'Professional', 'Organization'])
    for (const plan of schema.plans) {
      const conversion = grantRate(schema, plan.name)
      expect(conversion).toBeGreaterThan(0)
      for (const charge of plan.usageCharges) {
        const credits = rate(wire, plan.name, charge.featureKey) ?? NaN
        expect(charge.amountPerUnit).toBeCloseTo(credits * (conversion ?? NaN), 10)
      }
    }
    expect(grantRate(schema, 'Professional')).toBe(0.033)
  })

  it.each(['cursor', 'gemini'] as const)(
    '%s has no grants and keeps its rates as written',
    (id) => {
      expect(pricingTemplateSchema(id)).toEqual(
        normalisePricingSchema(PRICING_TEMPLATE_SCHEMAS[id]),
      )
    },
  )
})
