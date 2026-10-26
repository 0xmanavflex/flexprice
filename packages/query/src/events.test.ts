import { describe, expect, it } from 'vitest'
import { toUsageAnalytics } from './events'

describe('toUsageAnalytics', () => {
  it('reads revenue only when the server sent both a subtotal and a currency', () => {
    expect(toUsageAnalytics({ subtotal: '12.50', currency: 'usd', items: [] }).revenue).toEqual({
      amount: '12.50',
      currency: 'USD',
    })
  })

  it('leaves revenue null when the currency is missing or blank', () => {
    expect(toUsageAnalytics({ subtotal: '12.50', items: [] }).revenue).toBeNull()
    expect(toUsageAnalytics({ subtotal: '12.50', currency: '', items: [] }).revenue).toBeNull()
    expect(toUsageAnalytics({ subtotal: '12.50', currency: '  ', items: [] }).revenue).toBeNull()
    expect(toUsageAnalytics({ currency: 'USD', items: [] }).revenue).toBeNull()
  })
})
