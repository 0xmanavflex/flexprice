import { describe, expect, it } from 'vitest'
import {
  AddAddonRequest$outboundSchema,
  CancelSubscriptionRequest$outboundSchema,
  CreateCreditGrantRequest$outboundSchema,
  CreateEntitlementRequest$outboundSchema,
  CreateSubscriptionRequest$outboundSchema,
  ExecuteSubscriptionModifyRequest$outboundSchema,
} from '@flexprice/sdk/sdk/models'
import {
  BillingModel,
  CreditGrantCadence,
  CreditGrantExpiryType,
  type CreateSubscription,
  CreditGrantScope,
  EntitlementEntityType,
  FeatureType,
  emptyCreditGrant,
  emptySubscription,
} from '@fp/domain'
import { toCreditGrantRequest } from './creditGrants'
import { toEntitlementRequest } from './entitlements'
import {
  toAddAddonRequest,
  toAddCouponRequest,
  toCancelSubscriptionRequest,
  toCreateSubscriptionRequest,
} from './subscriptions'

const base: CreateSubscription = {
  ...emptySubscription(),
  customerId: 'cust_1',
  planId: 'plan_1',
  currency: 'USD',
}

describe('toCreateSubscriptionRequest', () => {
  it('sends only what a bare subscription needs', () => {
    expect(toCreateSubscriptionRequest(base)).toEqual({
      customerId: 'cust_1',
      planId: 'plan_1',
      currency: 'usd',
      billingPeriod: 'MONTHLY',
      billingPeriodCount: 1,
    })
  })

  it('every key survives the SDK outbound schema', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      startDate: '2026-11-01',
      trialPeriodDays: 14,
      priceOverrides: [{ priceId: 'price_1', billingModel: BillingModel.FlatFee, amount: '9' }],
      entitlementOverrides: [{ entitlementId: 'ent_1', usageLimit: 500 }],
      creditGrants: [
        {
          name: 'Welcome',
          credits: '100',
          cadence: CreditGrantCadence.OneTime,
          expirationType: CreditGrantExpiryType.Never,
          priority: 0,
        },
      ],
    })
    const parsed = CreateSubscriptionRequest$outboundSchema.parse(request) as Record<
      string,
      unknown
    >
    expect(Object.keys(parsed)).toHaveLength(Object.keys(request).length)
    expect(parsed['credit_grants']).toHaveLength(1)
    expect(parsed['override_line_items']).toHaveLength(1)
    expect(parsed['override_entitlements']).toHaveLength(1)
  })

  it('scopes a grant to the subscription, with no plan target', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      creditGrants: [
        {
          name: 'Top-up',
          credits: '5',
          cadence: CreditGrantCadence.OneTime,
          expirationType: CreditGrantExpiryType.Never,
          priority: 0,
        },
      ],
    })
    const [grant] = request['creditGrants'] as Record<string, unknown>[]
    expect(grant).toMatchObject({ scope: 'SUBSCRIPTION' })
    expect(grant).not.toHaveProperty('planId')
  })
})

describe('toCancelSubscriptionRequest', () => {
  it('sends the type, and a reason only when one was given', () => {
    expect(toCancelSubscriptionRequest({ cancellationType: 'end_of_period', reason: ' ' })).toEqual(
      {
        cancellationType: 'end_of_period',
      },
    )
    const request = toCancelSubscriptionRequest({
      cancellationType: 'immediate',
      reason: 'Churned',
    })
    expect(CancelSubscriptionRequest$outboundSchema.parse(request)).toEqual({
      cancellation_type: 'immediate',
      reason: 'Churned',
    })
  })
})

describe('contract-scoped creators', () => {
  it('tags an entitlement with the subscription it is for', () => {
    const request = toEntitlementRequest(
      { featureId: 'feat_1', featureType: FeatureType.Boolean, isEnabled: true },
      EntitlementEntityType.Subscription,
      'sub_1',
    )
    expect(request).toMatchObject({ entityType: 'SUBSCRIPTION', entityId: 'sub_1' })
    expect(CreateEntitlementRequest$outboundSchema.safeParse(request).success).toBe(true)
  })

  it('puts a subscription grant on subscriptionId, not planId or addonId', () => {
    const request = toCreditGrantRequest(
      { ...emptyCreditGrant(), name: 'Goodwill', credits: '100' },
      CreditGrantScope.Subscription,
      'sub_1',
    )
    expect(request).toMatchObject({ scope: 'SUBSCRIPTION', subscriptionId: 'sub_1' })
    expect(request).not.toHaveProperty('planId')
    expect(request).not.toHaveProperty('addonId')
    expect(CreateCreditGrantRequest$outboundSchema.safeParse(request).success).toBe(true)
  })

  it('keeps plan and add-on grants on their own fields', () => {
    const grant = { ...emptyCreditGrant(), name: 'g', credits: '1' }
    expect(toCreditGrantRequest(grant, CreditGrantScope.Plan, 'plan_1')).toMatchObject({
      planId: 'plan_1',
    })
    expect(toCreditGrantRequest(grant, CreditGrantScope.Addon, 'addon_1')).toMatchObject({
      addonId: 'addon_1',
    })
  })

  it('builds an add-on request the SDK accepts', () => {
    const request = toAddAddonRequest('sub_1', { addonId: 'addon_1' })
    expect(AddAddonRequest$outboundSchema.parse(request)).toEqual({
      subscription_id: 'sub_1',
      addon_id: 'addon_1',
    })
  })

  it('applies a coupon as an add modification', () => {
    const request = toAddCouponRequest('sub_1', { couponCode: ' WELCOME10 ' })
    expect(ExecuteSubscriptionModifyRequest$outboundSchema.parse(request)).toEqual({
      type: 'coupon',
      coupon_params: { action: 'add', coupon_code: 'WELCOME10', subscription_id: 'sub_1' },
    })
  })
})
