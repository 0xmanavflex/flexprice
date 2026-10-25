import { describe, expect, it } from 'vitest'
import {
  cloneFeatureSchema,
  createCostSheetSchema,
  createCouponSchema,
  createCustomerSchema,
  createFeatureSchema,
  createGroupSchema,
  createTaxRateSchema,
  defaultFeatureLookupKey,
  createAddonSchema,
  createPlanSchema,
  suggestKey,
  suggestTaxCode,
  KEY_PREFIX,
  editCreditGrantSchema,
  editEntitlementSchema,
  editFeatureSchema,
  editTaxRateSchema,
  emptyCloneFeature,
  emptyCostSheet,
  emptyCoupon,
  emptyCustomer,
  emptyGroup,
  emptyTaxRate,
} from './index'

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? []

describe('keys suggested from a name', () => {
  it('prefixes, lowercases and hyphenates like V1', () => {
    expect(suggestKey(KEY_PREFIX.customer, 'Acme Corp')).toBe('cust-acme-corp')
    expect(suggestKey(KEY_PREFIX.plan, '  Pro / Annual  ')).toBe('plan-pro-annual')
    expect(suggestKey(KEY_PREFIX.addon, 'Extra Seats')).toBe('addon-extra-seats')
    expect(suggestKey(KEY_PREFIX.group, 'Add-ons')).toBe('group-add-ons')
    expect(suggestKey(KEY_PREFIX.costSheet, 'Q4 Costs')).toBe('cost-sheet-q4-costs')
  })

  it('leaves the field empty for a blank name', () => {
    expect(suggestKey(KEY_PREFIX.customer, '   ')).toBe('')
    expect(suggestKey(KEY_PREFIX.customer, '()')).toBe('')
    expect(suggestTaxCode('')).toBe('')
  })

  it('gives a tax code the tax- prefix, as V1 does', () => {
    expect(suggestTaxCode('GST 18%')).toBe('tax-gst-18')
    expect(createTaxRateSchema.shape.code.safeParse(suggestTaxCode('GST 18%')).success).toBe(true)
  })

  it('produces keys the plan and add-on rules accept', () => {
    const plan = suggestKey(KEY_PREFIX.plan, 'Pro Annual')
    const addon = suggestKey(KEY_PREFIX.addon, 'Extra Seats')
    expect(createPlanSchema.shape.lookupKey.safeParse(plan).success).toBe(true)
    expect(createAddonSchema.shape.lookupKey.safeParse(addon).success).toBe(true)
  })
})

describe('feature create/edit/clone', () => {
  it('derives the default lookup key from the name', () => {
    expect(defaultFeatureLookupKey('API Calls (v2)')).toBe('feat-api-calls-v2')
    expect(defaultFeatureLookupKey('   ')).toBe('')
  })

  it('accepts a metered feature with filters and group by on a MAX meter', () => {
    const result = createFeatureSchema.safeParse({
      name: 'Peak seats',
      type: 'metered',
      unitSingular: 'seat',
      unitPlural: 'seats',
      meter: {
        eventName: 'seat.used',
        aggregationType: 'MAX',
        field: 'count',
        resetUsage: 'BILLING_PERIOD',
        groupBy: 'region',
        filters: [{ key: 'plan', values: ['pro'] }],
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects group by unless the meter is MAX', () => {
    const result = createFeatureSchema.safeParse({
      name: 'Calls',
      type: 'metered',
      meter: {
        eventName: 'call',
        aggregationType: 'COUNT',
        resetUsage: 'BILLING_PERIOD',
        groupBy: 'x',
      },
    })
    expect(messages(result)).toContain('Group by is only available with the Maximum aggregation')
  })

  it('requires both units or neither', () => {
    const result = createFeatureSchema.safeParse({
      name: 'Flag',
      type: 'boolean',
      unitSingular: 'x',
    })
    expect(messages(result)).toContain('Enter both the singular and plural unit, or neither')
  })

  it('edit keeps the name required and rejects an empty filter value list', () => {
    expect(editFeatureSchema.safeParse({ name: '' }).success).toBe(false)
    expect(
      editFeatureSchema.safeParse({ name: 'A', filters: [{ key: 'k', values: [] }] }).success,
    ).toBe(false)
    expect(
      editFeatureSchema.safeParse({ name: 'A', filters: [{ key: 'k', values: ['v'] }] }).success,
    ).toBe(true)
  })

  it('a clone draft is seeded from the source and needs a valid lookup key', () => {
    const draft = emptyCloneFeature({ name: 'Calls' })
    expect(draft).toEqual({ name: 'Calls (copy)', lookupKey: 'feat-calls-copy' })
    expect(cloneFeatureSchema.safeParse(draft).success).toBe(true)
    expect(cloneFeatureSchema.safeParse({ ...draft, lookupKey: 'Bad Key' }).success).toBe(false)
  })
})

describe('entitlement edit', () => {
  it('accepts a partial patch', () => {
    expect(editEntitlementSchema.safeParse({ usageLimit: 10 }).success).toBe(true)
  })

  it('rejects a negative or fractional limit', () => {
    expect(editEntitlementSchema.safeParse({ usageLimit: -1 }).success).toBe(false)
    expect(editEntitlementSchema.safeParse({ usageLimit: 1.5 }).success).toBe(false)
  })

  it('rejects clearing and changing the grant config together', () => {
    const result = editEntitlementSchema.safeParse({ clearGrantConfig: true, grantQuota: '5' })
    expect(result.success).toBe(false)
  })

  it('needs a duration value for a non subscription-period grant', () => {
    expect(editEntitlementSchema.safeParse({ grantDurationUnit: 'day' }).success).toBe(false)
    expect(
      editEntitlementSchema.safeParse({ grantDurationUnit: 'subscription_period' }).success,
    ).toBe(true)
  })
})

describe('credit grant edit', () => {
  it('rejects an end date in the past', () => {
    const past = new Date(Date.now() - 86_400_000)
    expect(editCreditGrantSchema.safeParse({ name: 'G', endDate: past }).success).toBe(false)
    const future = new Date(Date.now() + 86_400_000)
    expect(editCreditGrantSchema.safeParse({ name: 'G', endDate: future }).success).toBe(true)
  })
})

describe('cost sheet', () => {
  it('needs a name; the factory starts empty', () => {
    expect(createCostSheetSchema.safeParse(emptyCostSheet()).success).toBe(false)
    expect(createCostSheetSchema.safeParse({ ...emptyCostSheet(), name: 'Infra' }).success).toBe(
      true,
    )
  })
})

describe('customer', () => {
  it('needs an external id and a name, and validates email and country', () => {
    expect(createCustomerSchema.safeParse(emptyCustomer()).success).toBe(false)
    const ok = { ...emptyCustomer(), externalId: 'c1', name: 'Acme' }
    expect(createCustomerSchema.safeParse(ok).success).toBe(true)
    expect(createCustomerSchema.safeParse({ ...ok, email: 'nope' }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ ...ok, addressCountry: 'USA' }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ ...ok, addressCountry: 'US' }).success).toBe(true)
  })
})

describe('tax rate', () => {
  const ok = { ...emptyTaxRate(), name: 'GST', code: 'GST18', percentageValue: '18' }

  it('accepts a percentage in range and rejects out of range or non numeric', () => {
    expect(createTaxRateSchema.safeParse(ok).success).toBe(true)
    expect(createTaxRateSchema.safeParse({ ...ok, percentageValue: '101' }).success).toBe(false)
    expect(createTaxRateSchema.safeParse({ ...ok, percentageValue: '-1' }).success).toBe(false)
    expect(createTaxRateSchema.safeParse({ ...ok, percentageValue: 'abc' }).success).toBe(false)
  })

  it('requires an alphanumeric code', () => {
    expect(createTaxRateSchema.safeParse({ ...ok, code: 'a b' }).success).toBe(false)
    expect(createTaxRateSchema.safeParse({ ...ok, code: 'tax-gst_18' }).success).toBe(true)
  })

  it('edit covers name, code, description, metadata and status only', () => {
    expect(
      editTaxRateSchema.safeParse({ name: 'GST', code: 'GST', status: 'archived' }).success,
    ).toBe(true)
  })
})

describe('coupon', () => {
  const pct = { ...emptyCoupon(), name: 'Launch', percentageOff: '20' }

  it('validates a percentage coupon', () => {
    expect(createCouponSchema.safeParse(pct).success).toBe(true)
    expect(createCouponSchema.safeParse({ ...pct, percentageOff: '120' }).success).toBe(false)
    expect(createCouponSchema.safeParse({ ...pct, percentageOff: '' }).success).toBe(false)
  })

  it('a fixed coupon needs an amount and a currency', () => {
    const fixed = { ...emptyCoupon(), name: 'Credit', type: 'fixed' as const }
    expect(createCouponSchema.safeParse(fixed).success).toBe(false)
    expect(
      createCouponSchema.safeParse({ ...fixed, amountOff: '50.00', currency: 'USD' }).success,
    ).toBe(true)
  })

  it('a repeated cadence needs a duration in periods', () => {
    expect(createCouponSchema.safeParse({ ...pct, cadence: 'repeated' }).success).toBe(false)
    expect(
      createCouponSchema.safeParse({ ...pct, cadence: 'repeated', durationInPeriods: 3 }).success,
    ).toBe(true)
  })

  it('rejects a redemption window that ends before it starts', () => {
    const result = createCouponSchema.safeParse({
      ...pct,
      redeemAfter: new Date('2030-02-01'),
      redeemBefore: new Date('2030-01-01'),
    })
    expect(result.success).toBe(false)
  })
})

describe('group', () => {
  it('needs a name and a lowercase lookup key', () => {
    expect(createGroupSchema.safeParse(emptyGroup()).success).toBe(false)
    const ok = { ...emptyGroup('price'), name: 'Add-ons', lookupKey: 'add-ons' }
    expect(createGroupSchema.safeParse(ok).success).toBe(true)
    expect(createGroupSchema.safeParse({ ...ok, lookupKey: 'Add Ons' }).success).toBe(false)
  })
})
