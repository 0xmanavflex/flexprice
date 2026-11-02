import { describe, expect, it } from 'vitest'
import { FeatureType, emptyMeteredGrant, type CreateEntitlement } from '@fp/domain'
import { toEntitlementRequest, toUpdateEntitlementRequest } from './entitlements'

const metered = (draft: CreateEntitlement): CreateEntitlement => draft

describe('toEntitlementRequest with a V1 grant', () => {
  const base = {
    featureId: 'feat_1',
    featureType: FeatureType.Metered,
    usageLimit: 0,
    usageResetPeriod: null,
    isSoftLimit: false,
  } as const

  it('sends a daily window as V1 does, and no usage limit', () => {
    const request = toEntitlementRequest(
      metered({ ...base, grant: { ...emptyMeteredGrant(), quota: '1000' } }),
      'PLAN' as never,
      'plan_1',
    )
    expect(request).toEqual({
      featureId: 'feat_1',
      featureType: 'metered',
      entityType: 'PLAN',
      entityId: 'plan_1',
      grantMeasure: 'quantity',
      grantQuota: '1000',
      grantDurationUnit: 'day',
      grantDurationValue: 1,
      grantAllocationBehavior: 'first_usage',
      aggregationMode: 'additive',
    })
  })

  it('sends a billing-period window without a duration or allocation', () => {
    const request = toEntitlementRequest(
      metered({
        ...base,
        grant: { ...emptyMeteredGrant(), quota: '50', unit: 'subscription_period' },
      }),
      'PLAN' as never,
      'plan_1',
    )
    expect(request).toMatchObject({ grantQuota: '50', grantDurationUnit: 'subscription_period' })
    expect(request).not.toHaveProperty('grantDurationValue')
    expect(request).not.toHaveProperty('grantAllocationBehavior')
  })

  it('sends unlimited as grant_unlimited over the billing period', () => {
    const request = toEntitlementRequest(
      metered({ ...base, grant: { ...emptyMeteredGrant(), quota: null, aggregation: 'parallel' } }),
      'PLAN' as never,
      'plan_1',
    )
    expect(request).toMatchObject({
      grantUnlimited: true,
      grantDurationUnit: 'subscription_period',
      aggregationMode: 'parallel',
    })
    expect(request).not.toHaveProperty('grantQuota')
    expect(request).not.toHaveProperty('usageLimit')
  })
})

describe('toUpdateEntitlementRequest with a V1 grant', () => {
  it('sends the whole allowance, unlimited said outright', () => {
    expect(
      toUpdateEntitlementRequest({ grant: { ...emptyMeteredGrant(), quota: '50', unit: 'week' } }),
    ).toEqual({
      grantMeasure: 'quantity',
      grantUnlimited: false,
      grantQuota: '50',
      grantDurationUnit: 'week',
      grantDurationValue: 1,
      grantAllocationBehavior: 'first_usage',
      aggregationMode: 'additive',
    })
  })

  it('keeps a window longer than one unit', () => {
    expect(
      toUpdateEntitlementRequest({
        grant: { ...emptyMeteredGrant(), quota: '500', unit: 'week', every: 2 },
      }),
    ).toMatchObject({ grantDurationUnit: 'week', grantDurationValue: 2 })
  })

  it('clears the quota and resets per billing period when made unlimited', () => {
    expect(toUpdateEntitlementRequest({ grant: { ...emptyMeteredGrant(), quota: null } })).toEqual({
      grantMeasure: 'quantity',
      grantUnlimited: true,
      grantDurationUnit: 'subscription_period',
      aggregationMode: 'additive',
    })
  })
})

describe('toEntitlementRequest without a grant', () => {
  const base = {
    featureId: 'feat_1',
    featureType: FeatureType.Metered,
    usageResetPeriod: null,
    isSoftLimit: false,
  } as const

  it('leaves the limit out for unlimited, since the SDK rejects null', () => {
    const request = toEntitlementRequest(
      metered({ ...base, usageLimit: null }),
      'PLAN' as never,
      'plan_1',
    )
    expect(request).not.toHaveProperty('usageLimit')
  })

  it('sends a limit of zero', () => {
    const request = toEntitlementRequest(
      metered({ ...base, usageLimit: 0 }),
      'PLAN' as never,
      'plan_1',
    )
    expect(request.usageLimit).toBe(0)
  })
})
