import { describe, expect, it } from 'vitest'
import { priceSpan } from './analyticsPriceSpan'

// The labels are built with the formatter's own (default) locale, so the test
// holds under any machine locale; only the day matters here.
const utcDay = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  )

describe('priceSpan', () => {
  // Contract dates sit at midnight UTC: read in a zone west of UTC they would
  // land on the day before, so they are formatted in UTC.
  const oct1 = new Date('2026-10-01T00:00:00Z')
  const oct15 = new Date('2026-10-15T00:00:00Z')

  it('names the days a price applied, in UTC', () => {
    expect(priceSpan(oct15, null)).toBe(`From ${utcDay('2026-10-15')}`)
  })

  it('reads an end at midnight as exclusive: the last day billed is the day before', () => {
    expect(priceSpan(oct1, oct15)).toBe(`${utcDay('2026-10-01')} – ${utcDay('2026-10-14')}`)
    expect(priceSpan(null, oct15)).toBe(`Until ${utcDay('2026-10-14')}`)
  })

  it('shows a mid-day end as its own day', () => {
    expect(priceSpan(oct1, new Date('2026-10-15T12:00:00Z'))).toBe(
      `${utcDay('2026-10-01')} – ${utcDay('2026-10-15')}`,
    )
  })

  it('falls back to a plain label with no dates', () => {
    expect(priceSpan(null, null)).toBe('Price')
  })
})
