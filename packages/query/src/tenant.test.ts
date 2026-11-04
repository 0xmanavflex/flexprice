import { describe, expect, it } from 'vitest'
import { TenantStatus, isOverLimit } from '@fp/domain'
import {
  toTenant,
  toTenantBillingUsage,
  toTenantBillingWire,
  toUpdateTenantRequest,
} from './tenant'

/** `GET /tenants/{id}` as it came back live, after the SDK camelCased it. */
const tenantWire = {
  id: 'tenant_01KVSNYVMBNGWZZQGBQG0G7M2V',
  name: 'testing',
  status: 'published',
  billingDetails: {
    address: {
      addressCity: '',
      addressCountry: '',
      addressLine1: '',
      addressLine2: '',
      addressPostalCode: '',
      addressState: '',
    },
  },
  createdAt: new Date('2026-06-23T07:26:18.000Z'),
  updatedAt: new Date('2026-08-15T06:09:06.000Z'),
}

describe('toTenant', () => {
  it('maps the live response, flattening billing details', () => {
    const tenant = toTenant(tenantWire)
    expect(tenant.id).toBe('tenant_01KVSNYVMBNGWZZQGBQG0G7M2V')
    expect(tenant.name).toBe('testing')
    expect(tenant.status).toBe(TenantStatus.Published)
    expect(tenant.billingEmail).toBe('')
    expect(tenant.address).toEqual({
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    })
  })

  it('lifts the nested contact fields out of billing_details', () => {
    const tenant = toTenant({
      ...tenantWire,
      billingDetails: {
        email: 'billing@acme.test',
        helpEmail: 'help@acme.test',
        phone: '+1 555 0100',
        address: { addressLine1: '1 Main St', addressCity: 'Springfield' },
      },
    })
    expect(tenant.billingEmail).toBe('billing@acme.test')
    expect(tenant.helpEmail).toBe('help@acme.test')
    expect(tenant.phone).toBe('+1 555 0100')
    expect(tenant.address.line1).toBe('1 Main St')
    expect(tenant.address.city).toBe('Springfield')
  })

  it('is total for a record with no billing details at all', () => {
    const tenant = toTenant({ id: 't_1', name: 'Acme' })
    expect(tenant.address).toEqual({
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    })
    expect(tenant.createdAt).toBeNull()
  })
})

describe('toUpdateTenantRequest', () => {
  const draft = {
    name: 'Acme',
    billingEmail: 'billing@acme.test',
    helpEmail: '',
    phone: '',
    address: {
      line1: '1 Main St',
      line2: '',
      city: 'Springfield',
      state: '',
      postalCode: '',
      country: 'US',
    },
  }

  it('uses the SDK camelCase keys, not the wire snake_case', () => {
    // The generated zod schema strips keys the model does not declare, so a
    // literal `billing_details`/`address_line1` would serialise to nothing and
    // the address would silently never save.
    const request = toUpdateTenantRequest(draft)
    expect(request).toHaveProperty('billingDetails')
    expect(request).not.toHaveProperty('billing_details')
    const billing = request['billingDetails'] as Record<string, unknown>
    expect(billing).toHaveProperty('helpEmail')
    expect(billing['address']).toHaveProperty('addressLine1', '1 Main St')
    expect(billing['address']).toHaveProperty('addressPostalCode', '')
  })

  it('sends empty strings rather than omitting, so a field can be cleared', () => {
    const billing = toUpdateTenantRequest(draft)['billingDetails'] as Record<string, unknown>
    expect(billing['helpEmail']).toBe('')
    expect(billing['phone']).toBe('')
  })
})

/**
 * `GET /tenants/billing` as it came back live. Trimmed to one metered feature
 * with a limit and one unlimited static feature: the two cases the panel has
 * to render differently: plus the single subscription the tenant is on.
 */
const billingUsageWire = {
  usage: {
    customerId: 'cust_01KVSNYVMQEHYW9GYQTWECGJHG',
    period: null,
    features: [
      {
        feature: { id: 'feat_01JQ5WCVRGNF4SQ9M1D1QBKZNY', name: 'Events', type: 'metered' },
        totalLimit: 1000000,
        isUnlimited: false,
        currentUsage: '0',
        usagePercent: '0',
        isEnabled: true,
        isSoftLimit: true,
        nextUsageResetAt: new Date('2026-10-23T00:00:00Z'),
      },
      {
        feature: { id: 'feat_01JQ5WECSSM945GV3QP5AKCRES', name: 'Support SLA', type: 'static' },
        totalLimit: null,
        isUnlimited: true,
        currentUsage: '0',
        usagePercent: '0',
        isEnabled: true,
        isSoftLimit: false,
        nextUsageResetAt: null,
      },
    ],
  },
  subscriptions: [
    {
      id: 'subs_01KVSNYVN19M36R1E7HRYBGX9S',
      planId: 'plan_01JQ5WP8Z2NFPA538M323SE2JD',
      plan: { id: 'plan_01JQ5WP8Z2NFPA538M323SE2JD', name: 'Free' },
      subscriptionStatus: 'active',
      status: 'published',
      currency: 'usd',
      billingPeriod: 'MONTHLY',
      currentPeriodStart: new Date('2026-09-23T07:26:18Z'),
      currentPeriodEnd: new Date('2026-10-23T07:26:18Z'),
      cancelAtPeriodEnd: false,
      trialEnd: null,
    },
  ],
}

describe('toTenantBillingUsage', () => {
  it('maps the plan the tenant is on', () => {
    const [plan] = toTenantBillingUsage(billingUsageWire).plans
    expect(plan).toEqual({
      subscriptionId: 'subs_01KVSNYVN19M36R1E7HRYBGX9S',
      planId: 'plan_01JQ5WP8Z2NFPA538M323SE2JD',
      planName: 'Free',
      status: 'active',
      currency: 'usd',
      billingPeriod: 'MONTHLY',
      currentPeriodStart: new Date('2026-09-23T07:26:18Z'),
      currentPeriodEnd: new Date('2026-10-23T07:26:18Z'),
      cancelAtPeriodEnd: false,
      trialEnd: null,
    })
  })

  it('reads subscription_status, not the record’s archival status', () => {
    // `status: 'published'` on the same record means "not deleted", which is
    // not what a plan card means by status.
    expect(toTenantBillingUsage(billingUsageWire).plans[0]?.status).toBe('active')
  })

  it('keeps an unlimited entitlement’s limit null rather than zero', () => {
    const [, unlimited] = toTenantBillingUsage(billingUsageWire).features
    expect(unlimited?.isUnlimited).toBe(true)
    expect(unlimited?.limit).toBeNull()
  })

  it('keeps usage as the decimal strings the API sent', () => {
    const [metered] = toTenantBillingUsage(billingUsageWire).features
    expect(metered?.currentUsage).toBe('0')
    expect(metered?.usagePercent).toBe('0')
    expect(metered?.limit).toBe(1000000)
    expect(metered?.isSoftLimit).toBe(true)
  })

  it('tolerates the null period the live tenant returned', () => {
    const usage = toTenantBillingUsage(billingUsageWire)
    expect(usage.periodStart).toBeNull()
    expect(usage.periodEnd).toBeNull()
  })

  it('reads a period when one is present', () => {
    const usage = toTenantBillingUsage({
      ...billingUsageWire,
      usage: {
        ...billingUsageWire.usage,
        period: {
          startTime: new Date('2026-09-23T00:00:00Z'),
          endTime: new Date('2026-10-23T00:00:00Z'),
        },
      },
    })
    expect(usage.periodStart).toEqual(new Date('2026-09-23T00:00:00Z'))
  })

  it('is total for a tenant with no Flexprice subscription', () => {
    expect(toTenantBillingUsage({})).toEqual({
      plans: [],
      features: [],
      periodStart: null,
      periodEnd: null,
    })
  })
})

describe('isOverLimit', () => {
  const usage = toTenantBillingUsage(billingUsageWire)

  it('is false for an unlimited entitlement whatever the usage', () => {
    const unlimited = usage.features[1]
    expect(unlimited && isOverLimit({ ...unlimited, currentUsage: '99999999' })).toBe(false)
  })

  it('compares the decimal string against the numeric limit', () => {
    const metered = usage.features[0]
    expect(metered && isOverLimit({ ...metered, currentUsage: '1000001' })).toBe(true)
    expect(metered && isOverLimit({ ...metered, currentUsage: '1000000' })).toBe(false)
  })
})

/**
 * `GET /tenants/billing`: plural, the path the SDK does not have.
 *
 * Reached with `fetch`, so this body is the raw JSON: snake_case keys and
 * timestamps as strings, neither of which a generated client is there to
 * convert. Trimmed to the fields the mapper reads, from the live response.
 */
const rawBilling = {
  usage: {
    customer_id: 'cust_01',
    features: [
      {
        feature: { id: 'feat_01', name: 'Events', type: 'metered' },
        total_limit: 1_000_000,
        is_unlimited: false,
        current_usage: '12345',
        usage_percent: '1.2',
        is_enabled: true,
        is_soft_limit: false,
        next_usage_reset_at: '2026-10-01T00:00:00Z',
      },
      {
        feature: { id: 'feat_02', name: 'Seats', type: 'static' },
        total_limit: null,
        is_unlimited: true,
        current_usage: '3',
        usage_percent: '0',
        is_enabled: true,
        is_soft_limit: false,
        next_usage_reset_at: null,
      },
    ],
    period: null,
  },
  subscriptions: [
    {
      id: 'subs_01',
      plan_id: 'plan_01',
      plan: { id: 'plan_01', name: 'Free' },
      subscription_status: 'active',
      status: 'published',
      currency: 'usd',
      billing_period: 'MONTHLY',
      current_period_start: '2026-09-01T00:00:00Z',
      current_period_end: '2026-10-01T00:00:00Z',
      cancel_at_period_end: false,
      trial_end: null,
    },
  ],
}

describe('toTenantBillingWire', () => {
  it('normalises the raw body into the shape the SDK would have produced', () => {
    const usage = toTenantBillingUsage(toTenantBillingWire(rawBilling))

    expect(usage.plans[0]).toMatchObject({
      subscriptionId: 'subs_01',
      planId: 'plan_01',
      planName: 'Free',
      // `subscription_status`, not `status`: the latter is the row's archival
      // state, which is not what a plan card means by status.
      status: 'active',
      billingPeriod: 'MONTHLY',
      cancelAtPeriodEnd: false,
    })
  })

  it('turns the timestamp strings into dates, and the absent ones into null', () => {
    const usage = toTenantBillingUsage(toTenantBillingWire(rawBilling))

    expect(usage.plans[0]?.currentPeriodStart).toEqual(new Date('2026-09-01T00:00:00Z'))
    expect(usage.plans[0]?.trialEnd).toBeNull()
    // `period` came back null on the live tenant even with an active monthly
    // subscription, so both ends are genuinely optional.
    expect(usage.periodStart).toBeNull()
  })

  it('keeps an unlimited entitlement’s null limit rather than calling it zero', () => {
    const usage = toTenantBillingUsage(toTenantBillingWire(rawBilling))

    expect(usage.features[1]).toMatchObject({ limit: null, isUnlimited: true })
    expect(usage.features[0]).toMatchObject({ limit: 1_000_000, currentUsage: '12345' })
  })

  it('keeps a grant entitlement’s window, which its sources do not carry', () => {
    const usage = toTenantBillingUsage(
      toTenantBillingWire({
        usage: {
          features: [
            {
              feature: { id: 'feat_01', name: 'Events', type: 'metered' },
              total_limit: 100,
              grant_duration_unit: 'day',
              grant_duration_value: 1,
              grant_measure: 'quantity',
              sources: [{ entity_type: 'plan', entity_name: 'Pro' }],
            },
          ],
        },
      }),
    )

    expect(usage.features[0]).toMatchObject({
      grantDurationUnit: 'day',
      grantDurationValue: 1,
      grantMeasure: 'quantity',
    })
    expect(usage.features[0]?.sources[0]?.usageResetPeriod).toBe('')
  })

  it('reads the unit and what grants each entitlement', () => {
    const usage = toTenantBillingUsage(
      toTenantBillingWire({
        usage: {
          features: [
            {
              feature: { id: 'feat_01', name: 'Events', unit_plural: 'events' },
              sources: [
                {
                  subscription_id: 'subs_01',
                  entity_id: 'plan_01',
                  entity_type: 'plan',
                  entity_name: 'Growth',
                  usage_reset_period: 'MONTHLY',
                },
              ],
            },
          ],
        },
      }),
    )

    expect(usage.features[0]?.unit).toBe('events')
    expect(usage.features[0]?.sources).toEqual([
      {
        subscriptionId: 'subs_01',
        entityId: 'plan_01',
        entityType: 'plan',
        entityName: 'Growth',
        usageResetPeriod: 'MONTHLY',
        staticValue: '',
      },
    ])
    // The live tenant sends no sources; that is an empty list, not a missing one.
    expect(toTenantBillingUsage(toTenantBillingWire(rawBilling)).features[0]?.sources).toEqual([])
  })

  it('survives a body with nothing in it', () => {
    expect(toTenantBillingUsage(toTenantBillingWire(null))).toEqual({
      plans: [],
      features: [],
      periodStart: null,
      periodEnd: null,
    })
  })
})
