import { describe, expect, it } from 'vitest'
import { utcDayEnd, utcDayOf, utcDayStart } from './DateInput'

describe('UTC day helpers', () => {
  it('starts a day at midnight UTC', () => {
    expect(utcDayStart('2026-10-21')?.toISOString()).toBe('2026-10-21T00:00:00.000Z')
  })

  it('ends a day at its last UTC millisecond', () => {
    expect(utcDayEnd('2026-10-21')?.toISOString()).toBe('2026-10-21T23:59:59.999Z')
  })

  it('has no day for empty or malformed input', () => {
    expect(utcDayStart('')).toBeUndefined()
    expect(utcDayEnd('21/10/2026')).toBeUndefined()
    expect(utcDayStart('2026-13-40')).toBeUndefined()
  })

  it('reads the UTC day an instant falls on', () => {
    expect(utcDayOf(new Date('2026-10-21T23:59:59.999Z'))).toBe('2026-10-21')
    expect(utcDayOf(new Date('2026-10-21T00:00:00.000Z'))).toBe('2026-10-21')
    expect(utcDayOf(undefined)).toBe('')
    expect(utcDayOf(new Date('nope'))).toBe('')
  })

  it('round-trips a day through both ends', () => {
    expect(utcDayOf(utcDayStart('2027-03-01'))).toBe('2027-03-01')
    expect(utcDayOf(utcDayEnd('2027-03-01'))).toBe('2027-03-01')
  })
})
