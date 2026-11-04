import { describe, expect, it } from 'vitest'
import {
  allowancePeriod,
  type Entitlement,
  entitlementGrant,
  entitlementToEdit,
  meteredAllowanceLabel,
  meteredResetLabel,
} from './entitlement'
import { FeatureType } from './feature'

const row = (patch: Partial<Entitlement>): Entitlement => ({
  id: 'ent_1',
  featureId: 'feat_1',
  featureName: 'API calls',
  featureType: FeatureType.Metered,
  entityType: 'PLAN' as Entitlement['entityType'],
  entityId: 'plan_1',
  usageLimit: null,
  usageResetPeriod: null,
  isSoftLimit: false,
  staticValue: null,
  isEnabled: true,
  configValue: null,
  createdAt: null,
  ...patch,
})

describe('a metered allowance', () => {
  it('reads a daily grant quota, not the empty usage limit', () => {
    const entitlement = row({
      grantQuota: '10000',
      grantDurationUnit: 'day',
      grantMeasure: 'quantity',
    })
    expect(meteredAllowanceLabel(entitlement)).toBe('10,000')
    expect(meteredResetLabel(entitlement)).toBe('Daily')
    expect(entitlementToEdit(entitlement)).toEqual({
      grant: {
        measure: 'quantity',
        quota: '10000',
        unit: 'day',
        allocation: 'first_usage',
        aggregation: 'additive',
      },
    })
  })

  it('keeps a window longer than one unit', () => {
    const entitlement = row({ grantQuota: '500', grantDurationUnit: 'week', grantDurationValue: 2 })
    expect(entitlementGrant(entitlement)?.every).toBe(2)
    expect(meteredResetLabel(entitlement)).toBe('Every 2 weeks')
  })

  it('reads grant config with no quota as unlimited', () => {
    const entitlement = row({ grantDurationUnit: 'subscription_period', grantMeasure: 'quantity' })
    expect(meteredAllowanceLabel(entitlement)).toBe('Unlimited')
    expect(entitlementGrant(entitlement)?.quota).toBeNull()
  })

  it('falls back to the usage limit without grant config', () => {
    expect(meteredAllowanceLabel(row({ usageLimit: 2500 }))).toBe('2,500')
    expect(meteredAllowanceLabel(row({}))).toBe('Unlimited')
    expect(entitlementGrant(row({ usageLimit: 2500 }))).toBeNull()
  })

  it('reads an amount allowance as a value of usage, not a quantity', () => {
    const entitlement = row({
      grantQuota: '12.5',
      grantMeasure: 'amount',
      grantDurationUnit: 'subscription_period',
    })
    expect(meteredAllowanceLabel(entitlement)).toBe('12.5 of usage value')
  })
})

describe('allowancePeriod', () => {
  it('reads a grant window before the older reset period', () => {
    expect(allowancePeriod({ grantDurationUnit: 'day', grantDurationValue: 1 })).toBe('day')
    expect(allowancePeriod({ grantDurationUnit: 'WEEK', grantDurationValue: 2 })).toBe('2 weeks')
    expect(allowancePeriod({ grantDurationUnit: 'subscription_period' })).toBe('billing period')
    expect(allowancePeriod({ usageResetPeriod: 'MONTHLY', grantDurationUnit: 'day' })).toBe('day')
  })

  it('falls back to the usage reset period, and says nothing for one that never resets', () => {
    expect(allowancePeriod({ usageResetPeriod: 'DAILY' })).toBe('day')
    expect(allowancePeriod({ usageResetPeriod: 'ANNUAL' })).toBe('year')
    expect(allowancePeriod({ usageResetPeriod: 'NEVER' })).toBeNull()
    expect(allowancePeriod({})).toBeNull()
  })
})
