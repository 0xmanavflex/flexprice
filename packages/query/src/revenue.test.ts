import { describe, expect, it } from 'vitest'
import { toRevenueOverview } from './revenue'

describe('toRevenueOverview', () => {
  it('keeps the server decimals and orders currencies by how many customers they bill', () => {
    const overview = toRevenueOverview({
      summaries: {
        eur: { total_revenue: '10', total_usage_revenue: '4', total_fixed_revenue: '6' },
        usd: {
          total_revenue: '1500.50',
          total_usage_revenue: '500.50',
          total_fixed_revenue: '1000',
        },
      },
      items: [
        {
          customer_id: 'c1',
          customer_name: 'Acme',
          currency: 'usd',
          total_revenue: '500.50',
          total_usage_revenue: '500.50',
        },
        { customer_id: 'c2', customer_name: 'Globex', currency: 'usd', total_revenue: '1000' },
        { customer_id: 'c3', customer_name: 'Initech', currency: 'eur', total_revenue: '10' },
      ],
    })
    expect(overview.summaries.map((s) => s.currency)).toEqual(['USD', 'EUR'])
    expect(overview.summaries[0]?.total).toEqual({ amount: '1500.50', currency: 'USD' })
    expect(overview.summaries[0]?.usage.amount).toBe('500.50')
    const acme = overview.customers.find((c) => c.name === 'Acme')
    expect(acme?.usage.amount).toBe('500.50')
    expect(acme?.fixed.amount).toBe('0')
    // Highest first within a currency, compared as decimals.
    expect(overview.customers.filter((c) => c.total.currency === 'USD').map((c) => c.name)).toEqual(
      ['Globex', 'Acme'],
    )
  })

  it('treats an empty response as no revenue, and drops malformed amounts', () => {
    expect(toRevenueOverview({})).toEqual({ summaries: [], customers: [] })
    const overview = toRevenueOverview({
      items: [{ customer_id: 'c1', currency: 'usd', total_revenue: 'NaN' }],
    })
    expect(overview.customers).toEqual([])
  })
})
