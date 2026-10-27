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

  it('folds the line items of one feature into one row after a price change', () => {
    const result = toUsageAnalytics({
      currency: 'USD',
      subtotal: '15.25',
      items: [
        {
          featureId: 'feat_api',
          meterId: 'meter_api',
          priceId: 'price_old',
          subLineItemId: 'li_old',
          aggregationType: 'SUM',
          totalUsage: '1000',
          eventCount: 10,
          totalCost: '10.10',
          subscriptionLineItem: {
            startDate: '2026-10-01T00:00:00Z',
            endDate: '2026-10-15T00:00:00Z',
          },
          feature: { id: 'feat_api', name: 'API calls', unitPlural: 'calls' },
          points: [
            { timestamp: '2026-10-14T00:00:00Z', usage: '600', eventCount: 6 },
            { timestamp: '2026-10-15T00:00:00Z', usage: '400', eventCount: 4 },
          ],
        },
        {
          featureId: 'feat_api',
          meterId: 'meter_api',
          priceId: 'price_new',
          subLineItemId: 'li_new',
          aggregationType: 'SUM',
          totalUsage: '500',
          eventCount: 5,
          totalCost: '5.15',
          subscriptionLineItem: { startDate: '2026-10-15T00:00:00Z' },
          feature: { id: 'feat_api', name: 'API calls', unitPlural: 'calls' },
          points: [{ timestamp: '2026-10-15T00:00:00Z', usage: '500', eventCount: 5 }],
        },
        {
          featureId: 'feat_seats',
          totalUsage: '3',
          totalCost: '0',
          feature: { id: 'feat_seats', name: 'Seats' },
        },
      ],
    })

    expect(result.features.map((row) => row.featureId)).toEqual(['feat_api', 'feat_seats'])
    const [api] = result.features
    expect(api?.usage).toBe(1500)
    expect(api?.eventCount).toBe(15)
    // The exact sum of the server's per-price amounts, not a float.
    expect(api?.revenue).toEqual({ amount: '15.25', currency: 'USD' })
    expect(api?.points.map((point) => point.usage)).toEqual([600, 900])
    expect(api?.prices.map((price) => [price.id, price.revenue?.amount, price.usage])).toEqual([
      ['li_old', '10.10', 1000],
      ['li_new', '5.15', 500],
    ])
    expect(api?.prices[0]?.from?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(api?.prices[1]?.to).toBeNull()
  })

  it('does not add up a max meter across prices', () => {
    const item = (usage: string, line: string) => ({
      featureId: 'feat_seats',
      subLineItemId: line,
      aggregationType: 'MAX',
      totalUsage: usage,
    })
    const result = toUsageAnalytics({ items: [item('7', 'li_a'), item('4', 'li_b')] })
    expect(result.features).toHaveLength(1)
    expect(result.features[0]?.usage).toBe(7)
    expect(result.features[0]?.prices).toHaveLength(2)
  })
})
