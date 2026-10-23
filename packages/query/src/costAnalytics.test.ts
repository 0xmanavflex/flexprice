import { describe, expect, it } from 'vitest'
import { toCostAnalytics } from './costAnalytics'

describe('toCostAnalytics', () => {
  it('reads revenue, cost, margin and each meter cost as the server sent them', () => {
    const analytics = toCostAnalytics({
      currency: 'usd',
      totalRevenue: '500.00',
      totalCost: '191.00',
      margin: '309.00',
      marginPercent: '61.80',
      costAnalytics: [{ meterId: 'meter_api', totalCost: '100.80' }],
    })
    expect(analytics.revenue).toEqual({ amount: '500.00', currency: 'USD' })
    expect(analytics.margin).toEqual({ amount: '309.00', currency: 'USD' })
    expect(analytics.marginPercent).toBe(61.8)
    expect(analytics.costByMeter['meter_api']).toEqual({ amount: '100.80', currency: 'USD' })
  })

  it('leaves what the server did not give as null, not zero', () => {
    const analytics = toCostAnalytics({})
    expect(analytics).toEqual({
      revenue: null,
      cost: null,
      margin: null,
      marginPercent: null,
      costByMeter: {},
    })
  })
})
