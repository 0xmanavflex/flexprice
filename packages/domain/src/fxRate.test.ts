import { describe, expect, it } from 'vitest'
import {
  formatFxRate,
  fxOverrideStatus,
  fxRateDraftSchema,
  fxWindowsOverlap,
  emptyFxRateDraft,
} from './fxRate'

describe('forex rates', () => {
  it('reads one unit of the source currency, padded without rounding', () => {
    expect(formatFxRate('usd', 'inr', '83')).toBe('1 USD = 83.00 INR')
    expect(formatFxRate('eur', 'usd', '1.08765')).toBe('1 EUR = 1.08765 USD')
  })

  it('refuses a missing or same pair, a non-positive rate and a backwards window', () => {
    const issues = (patch: object) =>
      (
        fxRateDraftSchema.safeParse({ ...emptyFxRateDraft('usd', 'inr'), rate: '83', ...patch })
          .error?.issues ?? []
      ).map((issue) => issue.message)
    expect(issues({})).toEqual([])
    expect(issues({ toCurrency: '' })).toEqual(['Select both currencies.'])
    expect(issues({ toCurrency: 'USD' })).toEqual(['From and To must be different currencies.'])
    expect(issues({ rate: '0' })).toEqual(['Rate must be a number greater than 0.'])
    expect(issues({ rate: '1,5' })).toEqual(['Rate must be a number greater than 0.'])
    expect(issues({ startDate: '2026-11-01T00:00:00Z', endDate: '2026-10-01T00:00:00Z' })).toEqual([
      'Valid from must be before Valid until.',
    ])
  })

  it('places now in a window', () => {
    const now = new Date('2026-10-26T00:00:00Z')
    expect(fxOverrideStatus(null, null, now)).toBe('active')
    expect(fxOverrideStatus('2026-11-01T00:00:00Z', null, now)).toBe('scheduled')
    expect(fxOverrideStatus(null, '2026-10-01T00:00:00Z', now)).toBe('expired')
  })

  it('treats windows as half-open', () => {
    const october = { startDate: '2026-10-01T00:00:00Z', endDate: '2026-11-01T00:00:00Z' }
    const november = { startDate: '2026-11-01T00:00:00Z', endDate: null }
    expect(fxWindowsOverlap(october, november)).toBe(false)
    expect(fxWindowsOverlap(october, { startDate: null, endDate: null })).toBe(true)
  })
})
