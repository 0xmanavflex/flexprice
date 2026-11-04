import { describe, expect, it } from 'vitest'
import type { SubscriptionEntitlement, TenantFeatureUsage } from '@fp/domain'
import {
  entitlementRowsForContract,
  entitlementRowsFromUsage,
  entitlementValue,
} from './EntitlementUsage'

const usage = (patch: Partial<TenantFeatureUsage>): TenantFeatureUsage => ({
  featureId: 'feat_1',
  featureName: 'entitlement-test',
  featureType: 'metered',
  limit: 100,
  isUnlimited: false,
  currentUsage: '0',
  usagePercent: '0',
  isEnabled: true,
  isSoftLimit: false,
  nextUsageResetAt: null,
  unit: '',
  grantDurationUnit: '',
  grantDurationValue: null,
  grantMeasure: '',
  sources: [],
  ...patch,
})

const contract = (patch: Partial<SubscriptionEntitlement>): SubscriptionEntitlement => ({
  featureId: 'feat_1',
  name: 'Feature',
  enabled: true,
  usageLimit: null,
  softLimit: false,
  resetPeriodLabel: '',
  ...patch,
})

describe('a customer entitlement row', () => {
  it('keeps the grant window the usage row reports', () => {
    const [row] = entitlementRowsFromUsage([
      usage({ grantDurationUnit: 'day', grantDurationValue: 1, grantMeasure: 'quantity' }),
    ])
    expect(entitlementValue(row!, 'en-US')).toBe('100 / day')
  })

  it('falls back to the source reset period', () => {
    const [row] = entitlementRowsFromUsage([
      usage({
        sources: [
          {
            subscriptionId: 's',
            entityId: 'p',
            entityType: 'plan',
            entityName: 'Pro',
            usageResetPeriod: 'MONTHLY',
            staticValue: '',
          },
        ],
      }),
    ])
    expect(entitlementValue(row!, 'en-US')).toBe('100 / month')
  })

  it('names an amount allowance', () => {
    const [row] = entitlementRowsFromUsage([
      usage({ limit: 12.5, grantDurationUnit: 'subscription_period', grantMeasure: 'amount' }),
    ])
    expect(entitlementValue(row!, 'en-US')).toBe('12.5 of usage value / billing period')
  })
})

describe('a contract entitlement row with no usage reported', () => {
  it('reads boolean, static and config entitlements from the entitlement itself', () => {
    const rows = entitlementRowsForContract(
      [
        contract({ featureId: 'b', featureType: 'boolean' }),
        contract({ featureId: 's', featureType: 'static', staticValue: '10' }),
        contract({
          featureId: 'c',
          featureType: 'config',
          staticValue: '{"response_hours":4,"support":"24x7"}',
        }),
      ],
      undefined,
    )
    expect(rows.map((row) => entitlementValue(row, 'en-US'))).toEqual([
      'Included',
      '10',
      '{"response_hours":4,"support":"24x7"}',
    ])
  })

  it('keeps the allowance period', () => {
    const [row] = entitlementRowsForContract(
      [contract({ featureType: 'metered', usageLimit: 100, period: 'day' })],
      undefined,
    )
    expect(entitlementValue(row!, 'en-US')).toBe('100 / day')
  })
})
