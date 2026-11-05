import { afterEach, describe, expect, it } from 'vitest'
import {
  formatDateValue,
  formatStoredDay,
  isNamedZone,
  storedDayOf,
  utcDayEnd,
  utcDayOf,
  utcDayStart,
  zonedInstant,
  zonedParts,
} from './DateInput'

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

describe('stored day fields', () => {
  const zone = process.env.TZ
  afterEach(() => {
    if (zone === undefined) delete process.env.TZ
    else process.env.TZ = zone
  })

  it('reads a UTC day on that day, east and west of UTC', () => {
    for (const tz of ['America/Los_Angeles', 'Asia/Kolkata']) {
      process.env.TZ = tz
      expect(storedDayOf(utcDayStart('2026-10-21'))).toBe('2026-10-21')
      expect(storedDayOf(utcDayEnd('2026-10-21'))).toBe('2026-10-21')
      expect(formatStoredDay(utcDayEnd('2026-10-21')!, { locale: 'en-US' })).toBe('Oct 21, 2026')
      expect(formatStoredDay(utcDayStart('2026-10-21')!, { locale: 'en-US' })).toBe('Oct 21, 2026')
    }
  })

  it('reads an older local-day value on the local day it was picked', () => {
    process.env.TZ = 'America/Los_Angeles'
    // Saved before as local 23:59:59 on Oct 21, which is Oct 22 06:59:59 UTC.
    const legacy = new Date(2026, 9, 21, 23, 59, 59)
    expect(legacy.toISOString()).toBe('2026-10-22T06:59:59.000Z')
    expect(storedDayOf(legacy)).toBe('2026-10-21')
    expect(formatStoredDay(legacy, { locale: 'en-US' })).toBe('Oct 21, 2026')
  })

  it('reads the QA #34 dates on the day every screen shows (IST)', () => {
    process.env.TZ = 'Asia/Kolkata'
    const read = (iso: string) => formatStoredDay(new Date(iso), { locale: 'en-US' })
    // A draft saved for 4 Nov, local midnight: the contract page said 3 Nov.
    expect(read('2026-11-03T18:30:00Z')).toBe('Nov 4, 2026')
    // A trial ending at midnight IST on 11 Nov: the banners said 10 Nov.
    expect(read('2026-11-10T18:30:00Z')).toBe('Nov 11, 2026')
    // A coupon redeemable until 30 Nov: the detail page said 1 Dec.
    expect(read('2026-11-30T23:59:59.999Z')).toBe('Nov 30, 2026')
  })

  it('has no day for none', () => {
    expect(storedDayOf(undefined)).toBe('')
    expect(storedDayOf(new Date('nope'))).toBe('')
  })
})

describe('zoned time', () => {
  it('reads and writes a clock in an IANA zone', () => {
    // 09:30 in Kolkata (UTC+5:30) is 04:00 UTC.
    const instant = zonedInstant('Asia/Kolkata', 2026, 9, 21, 9, 30)
    expect(instant.toISOString()).toBe('2026-10-21T04:00:00.000Z')
    expect(zonedParts(instant, 'Asia/Kolkata')).toEqual({
      year: 2026,
      month: 9,
      day: 21,
      hour: 9,
      minute: 30,
    })
  })

  it('lands on the right hour either side of a daylight-saving change', () => {
    // New York: EDT (UTC-4) before Nov 1 2026, EST (UTC-5) after.
    expect(zonedInstant('America/New_York', 2026, 9, 31, 12, 0).toISOString()).toBe(
      '2026-10-31T16:00:00.000Z',
    )
    expect(zonedInstant('America/New_York', 2026, 10, 2, 12, 0).toISOString()).toBe(
      '2026-11-02T17:00:00.000Z',
    )
  })

  /**
   * QA #97. 1 Nov 2026 01:30 happens twice in New York: 05:30Z (EDT) and
   * 06:30Z (EST). Editing the minutes of the second must keep it the second.
   */
  describe('the repeated hour when daylight saving ends', () => {
    const second = new Date('2026-11-01T06:30:00.000Z')
    const first = new Date('2026-11-01T05:30:00.000Z')
    const zone = process.env.TZ
    afterEach(() => {
      if (zone === undefined) delete process.env.TZ
      else process.env.TZ = zone
    })

    it('keeps the second occurrence when its minutes change (IANA zone)', () => {
      expect(zonedParts(second, 'America/New_York')).toMatchObject({ hour: 1, minute: 30 })
      expect(zonedInstant('America/New_York', 2026, 10, 1, 1, 31, second).toISOString()).toBe(
        '2026-11-01T06:31:00.000Z',
      )
      expect(zonedInstant('America/New_York', 2026, 10, 1, 1, 31, first).toISOString()).toBe(
        '2026-11-01T05:31:00.000Z',
      )
    })

    it('keeps the second occurrence in the browser zone (Local)', () => {
      process.env.TZ = 'America/New_York'
      expect(zonedInstant('local', 2026, 10, 1, 1, 31, second).toISOString()).toBe(
        '2026-11-01T06:31:00.000Z',
      )
    })

    it('without a previous instant, or when its offset does not fit, takes the usual reading', () => {
      // No hint: the first occurrence, as before.
      expect(zonedInstant('America/New_York', 2026, 10, 1, 1, 31).toISOString()).toBe(
        '2026-11-01T05:31:00.000Z',
      )
      // An EST hint on a summer day: EST does not read 12:00 there, so EDT wins.
      expect(zonedInstant('America/New_York', 2026, 6, 1, 12, 0, second).toISOString()).toBe(
        '2026-07-01T16:00:00.000Z',
      )
      // Moving the time out of the repeated hour lands on the one reading there is.
      expect(zonedInstant('America/New_York', 2026, 10, 1, 3, 0, second).toISOString()).toBe(
        '2026-11-01T08:00:00.000Z',
      )
    })
  })

  it('treats UTC as UTC and anything unknown as not a named zone', () => {
    expect(zonedInstant('utc', 2026, 0, 1, 0, 0).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(isNamedZone('Asia/Kolkata')).toBe(true)
    expect(isNamedZone('UTC')).toBe(false)
    expect(isNamedZone('local')).toBe(false)
    expect(isNamedZone('Not/AZone')).toBe(false)
    expect(formatDateValue('2026-10-21T04:00:00.000Z', 'Asia/Kolkata')).toBe(
      'Oct 21, 2026, 09:30 AM Asia/Kolkata',
    )
  })
})
