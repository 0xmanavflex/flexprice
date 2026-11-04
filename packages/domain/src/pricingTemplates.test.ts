import { describe, expect, it } from 'vitest'
import { PRICING_TEMPLATE_SCHEMAS } from './pricingTemplates'
import { normalisePricingSchema, pricingSchemaProblems } from './pricingSchema'

describe('the Create with AI templates', () => {
  it.each(Object.entries(PRICING_TEMPLATE_SCHEMAS))(
    '%s normalises into a schema that can be created as it is',
    (_id, wire) => {
      const schema = normalisePricingSchema(wire)
      expect(schema.features.length).toBeGreaterThan(0)
      expect(schema.plans.length).toBeGreaterThan(0)
      expect(pricingSchemaProblems(schema)).toEqual([])
    },
  )
})
