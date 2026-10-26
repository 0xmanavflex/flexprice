import { describe, expect, it } from 'vitest'
import {
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
    const entitlement = row({ grantQuota: '10000', grantDurationUnit: 'day', grantMeasure: 'quantity' })
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
})
