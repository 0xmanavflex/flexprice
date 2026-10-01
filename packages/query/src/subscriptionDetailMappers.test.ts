import { describe, expect, it } from 'vitest'
import {
  toSubscriptionDetail,
  toSubscriptionEntitlement,
  toSubscriptionLine,
} from './subscriptions'

describe('subscription detail mappers', () => {
  it('keeps price amounts as strings and classifies the line', () => {
    const line = toSubscriptionLine({
      id: 'l1',
      planDisplayName: 'Pro',
      priceType: 'USAGE',
      billingPeriod: 'MONTHLY',
      price: { amount: '0.0020', currency: 'usd' },
    })
    expect(line.kind).toBe('usage')
    expect(line.name).toBe('Pro')
    expect(line.amount.amount).toBe('0.0020')
    expect(line.billingPeriodLabel).toBe('Monthly')
  })

  it('falls back on the subscription currency', () => {
    expect(toSubscriptionLine({ currency: 'EUR', price: { amount: '5' } }).amount.currency).toBe(
      'EUR',
    )
  })

  it('maps entitlements, treating a missing limit as unlimited', () => {
    expect(toSubscriptionEntitlement({ feature: { id: 'f', name: 'SSO' } })).toMatchObject({
      name: 'SSO',
      enabled: false,
      usageLimit: null,
      resetPeriodLabel: '',
    })
    expect(
      toSubscriptionEntitlement({
        feature: { id: 'f' },
        entitlement: { isEnabled: true, usageLimit: 10, usageResetPeriod: 'MONTHLY' },
      }),
    ).toMatchObject({ enabled: true, usageLimit: 10, resetPeriodLabel: 'Monthly' })
  })

  it('carries metadata and terms on the detail', () => {
    const detail = toSubscriptionDetail({ metadata: { a: 'b' }, paymentTerms: 'NET_30' })
    expect(detail.metadata).toEqual({ a: 'b' })
    expect(detail.paymentTerms).toBe('NET_30')
  })
})
