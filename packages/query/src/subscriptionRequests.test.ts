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
  emptyPhase,
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
      billingCycle: 'anniversary',
      prorationBehavior: 'create_prorations',
    })
  })

  it('every key survives the SDK outbound schema', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      startDate: '2026-11-01',
      trialPeriodDays: 14,
      phases: [
        {
          ...emptyPhase(),
          priceOverrides: [{ priceId: 'price_1', billingModel: BillingModel.FlatFee, amount: '9' }],
        },
      ],
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

describe('toCreateSubscriptionRequest — V1 contract fields', () => {
  it('sends a single phase at the top level: discounts, commitments, taxes, add-ons, billing', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      startDate: '2026-11-01',
      phases: [
        {
          endDate: '2027-11-01',
          priceOverrides: [],
          discounts: [{ couponId: 'cpn_all' }, { couponId: 'cpn_seat', priceId: 'price_seat' }],
        },
      ],
      commitmentAmount: '1000',
      commitmentDuration: 'ANNUAL',
      overageFactor: '1.2',
      enableTrueUp: true,
      chargeCommitments: [
        { priceId: 'price_api', type: 'quantity', value: '5000', overageFactor: '', trueUp: false },
      ],
      taxes: [
        {
          taxRateCode: 'GST18',
          name: 'GST',
          percentage: '18',
          taxBehavior: 'exclusive',
          priority: 1,
          autoApply: true,
        },
      ],
      addons: [{ addonId: 'addon_1', name: 'Support' }],
      billingCycle: 'calendar',
      billingAnchor: '2026-11-01',
      paymentTerms: '30 NET',
      prorate: false,
      autoInvoiceThreshold: '500',
      draft: true,
    })
    const wire = CreateSubscriptionRequest$outboundSchema.parse(request) as Record<string, unknown>
    expect(wire).toMatchObject({
      end_date: '2027-11-01T00:00:00.000Z',
      coupons: ['cpn_all'],
      line_item_coupons: { price_seat: ['cpn_seat'] },
      commitment_amount: '1000',
      commitment_duration: 'ANNUAL',
      overage_factor: '1.2',
      enable_true_up: true,
      line_item_commitments: {
        price_api: {
          commitment_type: 'quantity',
          commitment_quantity: 5000,
          enable_true_up: false,
        },
      },
      tax_rate_overrides: [{ tax_rate_code: 'GST18', currency: 'usd', tax_behavior: 'exclusive' }],
      addons: [{ addon_id: 'addon_1' }],
      billing_cycle: 'calendar',
      billing_anchor: '2026-11-01T00:00:00.000Z',
      payment_terms: '30 NET',
      proration_behavior: 'none',
      auto_invoice_threshold: '500',
      subscription_status: 'draft',
    })
    expect(wire).not.toHaveProperty('phases')
  })

  it('sends several phases, each starting where the last ended, and the contract ending with the last', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      startDate: '2026-11-01',
      phases: [
        {
          endDate: '2027-02-01',
          priceOverrides: [{ priceId: 'price_1', billingModel: BillingModel.FlatFee, amount: '0' }],
          discounts: [{ couponId: 'cpn_intro' }],
        },
        { endDate: '2027-11-01', priceOverrides: [], discounts: [] },
      ],
      chargeCommitments: [
        { priceId: 'price_api', type: 'amount', value: '50', overageFactor: '', trueUp: false },
      ],
    })
    const wire = CreateSubscriptionRequest$outboundSchema.parse(request) as Record<string, unknown>
    expect(wire['end_date']).toBe('2027-11-01T00:00:00.000Z')
    expect(wire['coupons']).toEqual(['cpn_intro'])
    expect(wire).not.toHaveProperty('line_item_commitments')
    expect(wire['phases']).toEqual([
      {
        start_date: '2026-11-01T00:00:00.000Z',
        end_date: '2027-02-01T00:00:00.000Z',
        override_line_items: [{ price_id: 'price_1', billing_model: 'FLAT_FEE', amount: '0' }],
        coupons: ['cpn_intro'],
      },
      { start_date: '2027-02-01T00:00:00.000Z', end_date: '2027-11-01T00:00:00.000Z' },
    ])
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

  it('sends a scheduled date, proration and the final-invoice policy', () => {
    const scheduled = CancelSubscriptionRequest$outboundSchema.parse(
      toCancelSubscriptionRequest({
        cancellationType: 'scheduled_date',
        reason: '',
        cancelAt: '2030-03-01',
        prorate: true,
      }),
    )
    expect(scheduled).toEqual({
      cancellation_type: 'scheduled_date',
      cancel_at: '2030-03-01T00:00:00.000Z',
      proration_behavior: 'create_prorations',
    })
    const now = CancelSubscriptionRequest$outboundSchema.parse(
      toCancelSubscriptionRequest({
        cancellationType: 'immediate',
        reason: '',
        prorate: false,
        generateInvoice: true,
      }),
    )
    expect(now).toMatchObject({
      proration_behavior: 'none',
      cancel_immediately_inovice_policy: 'generate_invoice',
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
