import { describe, expect, it } from 'vitest'
import {
  CancelSubscriptionRequest$outboundSchema,
  CreateSubscriptionRequest$outboundSchema,
} from '@flexprice/sdk/sdk/models'
import {
  BillingModel,
  CreditGrantCadence,
  CreditGrantExpiryType,
  type CreateSubscription,
  emptySubscription,
} from '@fp/domain'
import { toCancelSubscriptionRequest, toCreateSubscriptionRequest } from './subscriptions'

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
