import { describe, expect, it } from 'vitest'
import { lastEndedPeriod, parseRollforwardSearch } from './rollforwardSearch'

describe('parseRollforwardSearch', () => {
  it('reads an ended month, a search and a page', () => {
    expect(parseRollforwardSearch({ period: '2025-06', search: ' acme ', page: '3' })).toEqual({
      period: '2025-06',
      search: 'acme',
      page: 3,
    })
  })

  it('falls back to the last ended month for this month, a future one or a malformed one', () => {
    const thisMonth = new Date().toISOString().slice(0, 7)
    for (const period of [thisMonth, '2099-01', 'soon']) {
      expect(parseRollforwardSearch({ period }).period).toBe(lastEndedPeriod())
    }
  })
})
