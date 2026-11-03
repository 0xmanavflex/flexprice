import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REVENUE_RECOGNITION_SEARCH,
  parseRevenueRecognitionSearch,
} from './revenueRecognitionSearch'

describe('parseRevenueRecognitionSearch', () => {
  it('reads a range, page and Details', () => {
    expect(
      parseRevenueRecognitionSearch({
        from: '2026-04',
        to: '2027-03',
        page: '2',
        details: 'true',
        search: 'car wash',
      }),
    ).toEqual({
      from: '2026-04',
      to: '2027-03',
      page: 2,
      pageSize: 50,
      details: true,
      search: 'car wash',
    })
  })

  it('falls back to this year for a malformed month and swaps a backwards range', () => {
    expect(parseRevenueRecognitionSearch({ from: 'soon' }).from).toBe(
      DEFAULT_REVENUE_RECOGNITION_SEARCH.from,
    )
    expect(parseRevenueRecognitionSearch({ from: '2026-09', to: '2026-03' })).toMatchObject({
      from: '2026-03',
      to: '2026-09',
    })
  })

  it('keeps at most 36 months', () => {
    expect(parseRevenueRecognitionSearch({ from: '2024-01', to: '2027-12' }).to).toBe('2026-12')
  })
})
