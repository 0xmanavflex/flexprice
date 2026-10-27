import { describe, expect, it } from 'vitest'
import { priceSpan } from './analyticsPriceSpan'

describe('priceSpan', () => {
  // Contract dates sit at midnight UTC: read in a zone west of UTC they would
  // land on the day before, so they are formatted in UTC.
  const oct1 = new Date('2026-10-01T00:00:00Z')
  const oct15 = new Date('2026-10-15T00:00:00Z')

  it('names the days a price applied, in UTC', () => {
    expect(priceSpan(oct1, oct15)).toMatch(/Oct 1\b.*Oct 15/)
    expect(priceSpan(oct15, null)).toMatch(/^From Oct 15$/)
    expect(priceSpan(null, oct15)).toMatch(/^Until Oct 15$/)
  })

  it('falls back to a plain label with no dates', () => {
    expect(priceSpan(null, null)).toBe('Price')
  })
})
