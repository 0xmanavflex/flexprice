import { describe, expect, it } from 'vitest'
import {
  CloneFeatureRequest$outboundSchema,
  CreateCostsheetRequest$outboundSchema,
  CreateCouponRequest$outboundSchema,
  CreateCustomerRequest$outboundSchema,
  CreateFeatureRequest$outboundSchema,
  CreateGroupRequest$outboundSchema,
  CreateTaxRateRequest$outboundSchema,
  UpdateCostsheetRequest$outboundSchema,
  UpdateCreditGrantRequest$outboundSchema,
  UpdateCustomerRequest$outboundSchema,
  UpdateEntitlementRequest$outboundSchema,
  UpdateFeatureRequest$outboundSchema,
  UpdateTaxRateRequest$outboundSchema,
} from '@flexprice/sdk/sdk/models'
import { emptyCostSheet, emptyCoupon, emptyCustomer, emptyGroup, emptyTaxRate } from '@fp/domain'
import { toCreateCostSheetRequest, toUpdateCostSheetRequest } from './costSheets'
import { toCreateCouponRequest } from './coupons'
import { toCreateCustomerRequest, toUpdateCustomerRequest } from './customers'
import { toUpdateEntitlementRequest } from './entitlements'
import { toUpdateCreditGrantRequest } from './creditGrants'
import {
  toCloneFeatureRequest,
  toCreateFeatureRequest,
  toFeature,
  toUpdateFeatureRequest,
} from './features'
import { toCreateGroupRequest } from './groups'
import { toCreateTaxRateRequest, toTaxRate, toUpdateTaxRateRequest } from './taxRates'

/**
 * The SDK silently strips keys its request model does not declare, so a mapper
 * that misspells a field looks fine and sends nothing. Parsing through the SDK's
 * own outbound schema and comparing key counts catches that.
 */
function survives(
  schema: { parse: (v: unknown) => Record<string, unknown> },
  request: Record<string, unknown>,
): void {
  expect(Object.keys(schema.parse(request))).toHaveLength(Object.keys(request).length)
}

const alert = {
  alertEnabled: true,
  thresholdType: 'percentage' as const,
  warning: { condition: 'above' as const, threshold: '80' },
}

describe('feature requests', () => {
  const metered = {
    name: 'Peak seats',
    type: 'metered' as const,
    lookupKey: 'feat-peak-seats',
    description: 'Seats',
    groupId: 'grp_1',
    unitSingular: 'seat',
    unitPlural: 'seats',
    reportingUnit: { unitSingular: 'k', unitPlural: 'ks', conversionRate: '0.001' },
    alertSettings: alert,
    meter: {
      eventName: 'seat.used',
      aggregationType: 'MAX' as const,
      field: 'count',
      resetUsage: 'BILLING_PERIOD' as const,
      groupBy: 'region',
      filters: [{ key: 'plan', values: ['pro'] }],
    },
  }

  it('create carries every field V1 collects and survives the SDK', () => {
    const request = toCreateFeatureRequest(metered as never)
    survives(CreateFeatureRequest$outboundSchema as never, request)
    expect(request).toMatchObject({
      groupId: 'grp_1',
      reportingUnit: { conversionRate: 0.001 },
      meter: {
        aggregation: { type: 'MAX', groupBy: 'region' },
        filters: [{ key: 'plan', values: ['pro'] }],
      },
    })
  })

  it('create omits blank optional fields', () => {
    const request = toCreateFeatureRequest({
      name: 'Flag',
      type: 'boolean',
      description: '',
    } as never)
    expect(request).toEqual({ name: 'Flag', type: 'boolean' })
  })

  it('update sends only editable fields and survives the SDK', () => {
    const request = toUpdateFeatureRequest({
      name: 'Seats',
      description: 'd',
      groupId: 'grp_1',
      reportingUnit: metered.reportingUnit,
      alertSettings: alert,
      filters: [{ key: 'k', values: ['v'] }],
    } as never)
    survives(UpdateFeatureRequest$outboundSchema as never, request)
    expect(request).not.toHaveProperty('type')
    expect(request).not.toHaveProperty('lookupKey')
    expect(request).not.toHaveProperty('meter')
  })

  it('clone sends name, key and description', () => {
    const request = toCloneFeatureRequest({
      name: 'A (copy)',
      lookupKey: 'a-copy',
      description: 'd',
    })
    survives(CloneFeatureRequest$outboundSchema as never, request)
  })

  it('reads the new fields back', () => {
    const feature = toFeature({
      id: 'f1',
      type: 'metered',
      groupId: 'g1',
      reportingUnit: { unitSingular: 'a', unitPlural: 'b', conversionRate: 2 },
      meter: {
        aggregation: { type: 'MAX', field: 'count', groupBy: 'r' },
        filters: [{ key: 'k', values: ['v'] }],
      },
    })
    expect(feature.groupId).toBe('g1')
    expect(feature.reportingUnit).toEqual({
      unitSingular: 'a',
      unitPlural: 'b',
      conversionRate: '2',
    })
    expect(feature.meterFilters).toEqual([{ key: 'k', values: ['v'] }])
    expect(feature.aggregationGroupBy).toBe('r')
    expect(feature.aggregationField).toBe('count')
  })
})

describe('entitlement and credit grant updates', () => {
  it('entitlement update keeps only the keys that are set', () => {
    const request = toUpdateEntitlementRequest({
      usageLimit: 5,
      isSoftLimit: false,
      grantQuota: '10',
    })
    expect(request).toEqual({ usageLimit: 5, isSoftLimit: false, grantQuota: '10' })
    survives(UpdateEntitlementRequest$outboundSchema as never, request)
  })

  it('credit grant update sends name, end date and metadata', () => {
    const request = toUpdateCreditGrantRequest({
      name: 'G',
      endDate: new Date('2031-01-01'),
      metadata: { a: 'b' },
    })
    survives(UpdateCreditGrantRequest$outboundSchema as never, request)
    expect(toUpdateCreditGrantRequest({ name: 'G' })).toEqual({ name: 'G' })
  })
})

describe('cost sheet requests', () => {
  it('drops blank fields on create and update', () => {
    expect(toCreateCostSheetRequest({ ...emptyCostSheet(), name: 'Infra' })).toEqual({
      name: 'Infra',
    })
    const request = toUpdateCostSheetRequest({
      name: 'I',
      lookupKey: 'k',
      description: 'd',
      metadata: { a: 'b' },
    })
    survives(UpdateCostsheetRequest$outboundSchema as never, request)
    survives(CreateCostsheetRequest$outboundSchema as never, request)
  })
})

describe('customer requests', () => {
  it('sends the billing configuration chosen on create', () => {
    const request = toCreateCustomerRequest({
      ...emptyCustomer(),
      externalId: 'c1',
      name: 'Acme',
      taxTreatment: 'exempt',
      timezone: 'Asia/Kolkata',
    })
    expect(request).toMatchObject({ taxTreatment: 'exempt', timezone: 'Asia/Kolkata' })
    survives(CreateCustomerRequest$outboundSchema as never, request)
  })

  it('maps phone to contact and omits blanks', () => {
    const request = toCreateCustomerRequest({
      ...emptyCustomer(),
      externalId: 'c1',
      name: 'Acme',
      email: 'a@b.co',
      phone: '+1 555',
      addressLine1: '1 Main',
      addressCountry: 'US',
      metadata: { k: 'v' },
    })
    expect(request).toMatchObject({ contact: '+1 555', taxTreatment: 'taxable' })
    expect(request).not.toHaveProperty('addressCity')
    survives(CreateCustomerRequest$outboundSchema as never, request)
    survives(
      UpdateCustomerRequest$outboundSchema as never,
      toUpdateCustomerRequest({
        ...emptyCustomer(),
        externalId: 'c1',
        name: 'Acme',
        phone: '1',
      }),
    )
  })
})

describe('tax rate requests', () => {
  it('create is always a percentage rate', () => {
    const request = toCreateTaxRateRequest({
      ...emptyTaxRate(),
      name: 'GST',
      code: 'GST18',
      percentageValue: '18',
      description: 'd',
    })
    expect(request).toMatchObject({ taxRateType: 'percentage', percentageValue: '18' })
    survives(CreateTaxRateRequest$outboundSchema as never, request)
  })

  it('update maps status to the wire spelling and leaves value and scope out', () => {
    const request = toUpdateTaxRateRequest({ name: 'GST', code: 'G', status: 'archived' })
    expect(request).toEqual({ name: 'GST', code: 'G', taxRateStatus: 'INACTIVE' })
    survives(UpdateTaxRateRequest$outboundSchema as never, request)
  })

  it('reads metadata', () => {
    expect(toTaxRate({ id: 't', metadata: { a: 'b' } }).metadata).toEqual({ a: 'b' })
  })
})

describe('coupon and group requests', () => {
  it('a percentage coupon never carries amount fields', () => {
    const request = toCreateCouponRequest({
      ...emptyCoupon(),
      name: 'Launch',
      percentageOff: '20',
      couponCode: 'L20',
      maxRedemptions: 5,
      redeemAfter: new Date('2030-01-01T00:00:00Z'),
    })
    expect(request).toMatchObject({ percentageOff: '20', redeemAfter: '2030-01-01T00:00:00.000Z' })
    expect(request).not.toHaveProperty('amountOff')
    survives(CreateCouponRequest$outboundSchema as never, request)
  })

  it('a fixed coupon sends amount and currency, and duration only when repeated', () => {
    const request = toCreateCouponRequest({
      ...emptyCoupon(),
      name: 'Credit',
      type: 'fixed',
      amountOff: '50.00',
      currency: 'USD',
      cadence: 'repeated',
      durationInPeriods: 3,
    })
    expect(request).toMatchObject({ amountOff: '50.00', currency: 'USD', durationInPeriods: 3 })
    expect(request).not.toHaveProperty('percentageOff')
    const once = toCreateCouponRequest({
      ...emptyCoupon(),
      name: 'x',
      percentageOff: '5',
      durationInPeriods: 3,
    })
    expect(once).not.toHaveProperty('durationInPeriods')
  })

  it('group create sends name, key and entity type', () => {
    const request = toCreateGroupRequest({ ...emptyGroup('price'), name: 'G', lookupKey: 'g' })
    expect(request).toEqual({ name: 'G', lookupKey: 'g', entityType: 'price' })
    survives(CreateGroupRequest$outboundSchema as never, request)
  })
})
