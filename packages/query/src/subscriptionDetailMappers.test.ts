import { describe, expect, it } from 'vitest'
import {
  toPendingSchedules,
  toSubscriptionDetail,
  toSubscriptionEntitlement,
  toSubscriptionLine,
  toSubscriptionUsage,
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

describe('subscription detail additions', () => {
  it('reads commitment, trial start and latest invoice', () => {
    const detail = toSubscriptionDetail({
      currency: 'usd',
      commitmentAmount: '500.00',
      trialStart: new Date('2026-01-01'),
      timezone: 'UTC',
      lookupKey: 'acme-pro',
      latestInvoice: { id: 'inv_1', invoiceNumber: 'INV-0001' },
    })
    expect(detail.commitmentAmount).toEqual({ amount: '500.00', currency: 'USD' })
    expect(detail.latestInvoice).toEqual({ id: 'inv_1', number: 'INV-0001' })
    expect(detail.lookupKey).toBe('acme-pro')
  })

  it('treats a zero or absent commitment and invoice as none', () => {
    const detail = toSubscriptionDetail({ commitmentAmount: '0' })
    expect(detail.commitmentAmount).toBeNull()
    expect(detail.latestInvoice).toBeNull()
  })
})

describe('toSubscriptionUsage', () => {
  it('maps charges and the commitment', () => {
    const usage = toSubscriptionUsage({
      amount: 120.5,
      currency: 'usd',
      commitmentAmount: 100,
      commitmentUtilized: 100,
      overageAmount: 20.5,
      hasOverage: true,
      charges: [
        { meterDisplayName: 'API calls', quantity: 4200, amount: 0.0000001, meterId: 'm1' },
        { quantity: 1, amount: 20.5, isOverage: true, subscriptionLineItemId: 'li_2' },
      ],
    })
    expect(usage.total.amount).toBe('120.5')
    expect(usage.commitment?.amount).toBe('100')
    expect(usage.overage?.amount).toBe('20.5')
    expect(usage.charges[0]?.name).toBe('API calls')
    expect(usage.charges[0]?.amount.amount).toBe('0.0000001')
    expect(usage.charges[1]).toMatchObject({ id: 'li_2', name: 'Usage', isOverage: true })
  })

  it('is total for an empty response', () => {
    const usage = toSubscriptionUsage({})
    expect(usage.total.amount).toBe('0')
    expect(usage.commitment).toBeNull()
    expect(usage.charges).toEqual([])
  })
})

describe('toPendingSchedules', () => {
  it('keeps only pending, known schedule types', () => {
    const schedules = toPendingSchedules([
      { id: 's1', scheduleType: 'plan_change', status: 'pending', canBeCancelled: true },
      { id: 's2', scheduleType: 'cancellation', status: 'executed' },
      { id: 's3', scheduleType: 'something_new', status: 'pending' },
    ])
    expect(schedules.map((s) => s.id)).toEqual(['s1'])
    expect(schedules[0]?.canBeCancelled).toBe(true)
  })
})
