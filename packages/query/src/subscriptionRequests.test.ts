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
  toRemoveCouponRequest,
  toCancelSubscriptionRequest,
  toCreateSubscriptionRequest,
  subscriptionGrantStart,
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
      prorationBehavior: 'none',
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
      creditGrantsChanged: true,
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

  it('routes invoices to another customer by external id', () => {
    expect(toCreateSubscriptionRequest(base)).not.toHaveProperty('inheritance')
    const request = toCreateSubscriptionRequest({
      ...base,
      invoicingCustomerExternalId: 'payer_ext',
    })
    expect(request['inheritance']).toEqual({ invoicingCustomerExternalId: 'payer_ext' })
    const parsed = CreateSubscriptionRequest$outboundSchema.parse(request) as Record<
      string,
      unknown
    >
    expect(parsed['inheritance']).toEqual({ invoicing_customer_external_id: 'payer_ext' })
  })

  it('names the inherited customers alone, beside a commitment, as V1 sends them', () => {
    // The API refuses `invoicing_customer_external_id` beside inherited
    // customers, so a parent contract sends only the children: the contract's
    // own customer pays. The commitment rides on the parent unchanged.
    const request = toCreateSubscriptionRequest({
      ...base,
      commitmentAmount: '1000',
      inheritedCustomerExternalIds: ['child_a', 'child_b'],
    })
    expect(request['inheritance']).toEqual({
      externalCustomerIdsToInheritSubscription: ['child_a', 'child_b'],
    })
    expect(request['commitmentAmount']).toBe('1000')
    const parsed = CreateSubscriptionRequest$outboundSchema.parse(request) as Record<
      string,
      unknown
    >
    expect(parsed['inheritance']).toEqual({
      external_customer_ids_to_inherit_subscription: ['child_a', 'child_b'],
    })
    expect(parsed['commitment_amount']).toBe('1000')
    expect(parsed).not.toHaveProperty('auto_invoice_threshold')
  })

  it("leaves the plan's grants alone until they are changed, then sends the whole list", () => {
    const grant = {
      name: 'Plan credits',
      credits: '100',
      cadence: CreditGrantCadence.OneTime,
      expirationType: CreditGrantExpiryType.Never,
      priority: 0,
    }
    // Untouched: the API applies the plan's own grants.
    expect(toCreateSubscriptionRequest({ ...base, creditGrants: [grant] })).not.toHaveProperty(
      'creditGrants',
    )
    // All removed: an empty list replaces them.
    expect(
      toCreateSubscriptionRequest({ ...base, creditGrants: [], creditGrantsChanged: true })[
        'creditGrants'
      ],
    ).toEqual([])
  })

  it('scopes a grant to the subscription, with no plan target', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      creditGrantsChanged: true,
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

describe('toCreateSubscriptionRequest: V1 contract fields', () => {
  it('sends a single phase at the top level: discounts, commitments, taxes, add-ons, billing', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      startDate: '2026-11-01',
      phases: [
        {
          endDate: '2027-11-01',
          priceOverrides: [],
          quantities: [],
          extraCharges: [],
          discounts: [{ couponId: 'cpn_all' }, { couponId: 'cpn_seat', priceId: 'price_seat' }],
        },
      ],
      commitmentAmount: '1000',
      commitmentDuration: 'ANNUAL',
      overageFactor: '1.2',
      enableTrueUp: true,
      chargeCommitments: [
        {
          priceId: 'price_api',
          type: 'quantity',
          value: '5000',
          duration: '',
          overageFactor: '',
          trueUp: false,
          bucketSize: '',
          windowed: false,
          windows: [],
        },
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

  it('sends a charge commitment per bucket, with its period, bucket size and time windows', () => {
    const wire = CreateSubscriptionRequest$outboundSchema.parse(
      toCreateSubscriptionRequest({
        ...base,
        phases: [
          {
            ...emptyPhase(),
            priceOverrides: [
              { priceId: 'price_a', billingModel: BillingModel.FlatFee, amount: '9' },
            ],
          },
        ],
        chargeCommitments: [
          {
            priceId: 'price_gpu',
            type: 'quantity',
            value: '10000',
            duration: 'MONTHLY',
            overageFactor: '1.5',
            trueUp: true,
            bucketSize: 'MINUTE',
            windowed: true,
            windows: [
              {
                id: 'win_1',
                start: '09:00',
                end: '17:30',
                type: 'amount',
                value: '200',
                overageFactor: '',
                trueUp: false,
                billingModel: 'PACKAGE',
                price: '2',
                packageSize: '1000',
              },
            ],
            priceBase: {
              entityId: 'plan_1',
              entityType: 'PLAN',
              meterId: 'meter_gpu',
              currency: 'USD',
              billingPeriod: 'MONTHLY',
              billingPeriodCount: 1,
              invoiceCadence: 'ARREAR',
            },
          },
        ],
      }),
    ) as Record<string, unknown>
    expect(wire['override_line_items']).toEqual([
      { price_id: 'price_a', billing_model: 'FLAT_FEE', amount: '9' },
      { price_id: 'price_gpu', bucket_size: 'MINUTE' },
    ])
    expect(wire['line_item_commitments']).toEqual({
      price_gpu: {
        commitment_type: 'quantity',
        commitment_quantity: 10000,
        commitment_duration: 'MONTHLY',
        overage_factor: 1.5,
        enable_true_up: true,
        is_window_commitment: true,
        commitment_time_buckets: [
          expect.objectContaining({
            start: { hour: 9, minute: 0 },
            end: { hour: 17, minute: 30 },
            commitment_type: 'amount',
            commitment_value: '200',
            true_up_enabled: false,
            price: expect.objectContaining({
              type: 'USAGE',
              billing_model: 'PACKAGE',
              amount: '2',
              meter_id: 'meter_gpu',
              currency: 'usd',
              transform_quantity: { divide_by: 1000, round: 'up' },
            }),
          }),
        ],
      },
    })
  })

  it('folds a fixed charge quantity into its override, or sends it alone', () => {
    const wire = CreateSubscriptionRequest$outboundSchema.parse(
      toCreateSubscriptionRequest({
        ...base,
        phases: [
          {
            ...emptyPhase(),
            priceOverrides: [
              { priceId: 'price_a', billingModel: BillingModel.FlatFee, amount: '9' },
            ],
            quantities: [
              { priceId: 'price_a', quantity: '3' },
              { priceId: 'price_seats', quantity: '25' },
            ],
          },
        ],
      }),
    ) as Record<string, unknown>
    expect(wire['override_line_items']).toEqual([
      { price_id: 'price_a', billing_model: 'FLAT_FEE', amount: '9', quantity: '3' },
      { price_id: 'price_seats', quantity: '25' },
    ])
  })

  it('sends charges for this contract alone as line_items: on the contract, or on each phase', () => {
    const extra = {
      charge: {
        type: 'FIXED' as const,
        billingModel: 'FLAT_FEE' as const,
        currency: 'USD',
        billingPeriod: 'ONETIME' as const,
        invoiceCadence: 'ADVANCE' as const,
        displayName: 'Onboarding',
        amount: '250.00',
      },
      quantity: '1',
      startDate: '',
      proration: 'none' as const,
      terms: { bucketSize: '' as const, commitment: null },
    }
    const single = CreateSubscriptionRequest$outboundSchema.parse(
      toCreateSubscriptionRequest({
        ...base,
        phases: [{ ...emptyPhase(), extraCharges: [extra] }],
      }),
    ) as Record<string, unknown>
    expect(single['line_items']).toEqual([
      expect.objectContaining({ display_name: 'Onboarding', price: expect.anything() }),
    ])

    const phased = CreateSubscriptionRequest$outboundSchema.parse(
      toCreateSubscriptionRequest({
        ...base,
        startDate: '2026-11-01',
        phases: [
          { ...emptyPhase(), endDate: '2027-01-01' },
          { ...emptyPhase(), extraCharges: [extra] },
        ],
      }),
    ) as Record<string, unknown>
    expect(phased).not.toHaveProperty('line_items')
    const phases = phased['phases'] as Record<string, unknown>[]
    expect(phases[1]?.['line_items']).toHaveLength(1)
  })

  it('sends include_price_ids only when charges at other cadences are opted in', () => {
    expect(toCreateSubscriptionRequest(base)).not.toHaveProperty('includePriceIds')
    const wire = CreateSubscriptionRequest$outboundSchema.parse(
      toCreateSubscriptionRequest({ ...base, includePriceIds: ['price_m', 'price_q'] }),
    ) as Record<string, unknown>
    expect(wire['include_price_ids']).toEqual(['price_m', 'price_q'])
  })

  it('sends several phases, each starting where the last ended, and the contract ending with the last', () => {
    const request = toCreateSubscriptionRequest({
      ...base,
      startDate: '2026-11-01',
      phases: [
        {
          endDate: '2027-02-01',
          priceOverrides: [{ priceId: 'price_1', billingModel: BillingModel.FlatFee, amount: '0' }],
          quantities: [],
          extraCharges: [],
          discounts: [{ couponId: 'cpn_intro' }],
        },
        {
          endDate: '2027-11-01',
          priceOverrides: [],
          quantities: [],
          discounts: [],
          extraCharges: [],
        },
      ],
      chargeCommitments: [
        {
          priceId: 'price_api',
          type: 'amount',
          value: '50',
          duration: '',
          overageFactor: '',
          trueUp: false,
          bucketSize: '',
          windowed: false,
          windows: [],
        },
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
      cancel_immediately_invoice_policy: 'generate_invoice',
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

  it("sends an add-on's commitments keyed by its price, as the SDK serialises them", () => {
    const request = toAddAddonRequest('sub_1', {
      addonId: 'addon_1',
      commitments: [
        {
          priceId: 'price_addon_api',
          type: 'amount',
          value: '500',
          overageFactor: '1.5',
          trueUp: true,
          windowed: false,
          bucketSize: '',
          duration: '',
          windows: [],
        },
      ],
    })
    expect(AddAddonRequest$outboundSchema.parse(request)).toMatchObject({
      addon_id: 'addon_1',
      line_item_commitments: {
        price_addon_api: {
          commitment_type: 'amount',
          commitment_amount: 500,
          overage_factor: 1.5,
          enable_true_up: true,
        },
      },
    })
  })

  it("sends an add-on commitment's bucket size as that price's override", () => {
    const request = toAddAddonRequest('sub_1', {
      addonId: 'addon_1',
      commitments: [
        {
          priceId: 'price_addon_api',
          type: 'quantity',
          value: '100',
          overageFactor: '',
          trueUp: false,
          windowed: true,
          bucketSize: 'HOUR',
          duration: '',
          windows: [],
        },
      ],
    })
    expect(AddAddonRequest$outboundSchema.parse(request)).toMatchObject({
      override_line_items: [{ price_id: 'price_addon_api', bucket_size: 'HOUR' }],
    })
  })

  it('applies a coupon as an add modification', () => {
    const request = toAddCouponRequest('sub_1', { couponCode: ' WELCOME10 ' })
    expect(ExecuteSubscriptionModifyRequest$outboundSchema.parse(request)).toEqual({
      type: 'coupon',
      coupon_params: { action: 'add', coupon_code: 'WELCOME10', subscription_id: 'sub_1' },
    })
  })

  it('applies a coupon to one charge and removes an association by id', () => {
    const added = toAddCouponRequest('sub_1', { couponCode: 'LINE', lineItemId: 'line_2' })
    expect(ExecuteSubscriptionModifyRequest$outboundSchema.parse(added)).toEqual({
      type: 'coupon',
      coupon_params: {
        action: 'add',
        coupon_code: 'LINE',
        subscription_line_item_id: 'line_2',
      },
    })
    expect(added.couponParams).not.toHaveProperty('subscriptionId')
    const removed = toRemoveCouponRequest('assoc_1')
    expect(ExecuteSubscriptionModifyRequest$outboundSchema.parse(removed)).toEqual({
      type: 'coupon',
      coupon_params: { action: 'remove', coupon_association_id: 'assoc_1' },
    })
  })
})

describe('subscriptionGrantStart', () => {
  // The API refuses a subscription-scoped grant without a start_date.
  const now = new Date('2026-10-22T12:00:00Z')
  const periodEnd = new Date('2026-11-01T00:00:00Z')

  it('starts a one-time grant now', () => {
    expect(subscriptionGrantStart({ cadence: CreditGrantCadence.OneTime }, periodEnd, now)).toBe(
      now,
    )
  })

  it("starts a recurring grant at the end of the contract's current period", () => {
    expect(subscriptionGrantStart({ cadence: CreditGrantCadence.Recurring }, periodEnd, now)).toBe(
      periodEnd,
    )
  })

  it('starts a recurring grant now when the period end is unknown', () => {
    expect(subscriptionGrantStart({ cadence: CreditGrantCadence.Recurring }, null, now)).toBe(now)
  })
})
