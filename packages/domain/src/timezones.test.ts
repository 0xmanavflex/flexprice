import { describe, expect, it } from 'vitest'
import { IANA_TIMEZONES, timezoneChoices, toTimezoneOption, timezoneOptions } from './timezones'

/** Fixed dates, because an abbreviation and an offset both move with the season. */
const JANUARY = new Date('2026-01-15T12:00:00Z')
const JULY = new Date('2026-07-15T12:00:00Z')

describe('toTimezoneOption', () => {
  it('names a zone Intl will not name, from the list', () => {
    const option = toTimezoneOption('Asia/Kolkata', JANUARY)
    expect(option).toMatchObject({
      zone: 'Asia/Kolkata',
      abbreviation: 'IST',
      offset: 'UTC+05:30',
      label: 'Asia/Kolkata · IST · UTC+05:30',
    })
  })

  /*
   * The reason the list exists.
   *
   * `Intl` answers "GMT+5:30" for `timeZoneName: 'short'` outside the US:
   * the offset again, not a name. If a future runtime starts answering "IST"
   * this still passes, because Intl's answer is preferred and would be right.
   */
  it('does not mistake an offset for an abbreviation', () => {
    for (const zone of ['Asia/Kolkata', 'Asia/Singapore', 'Europe/Paris']) {
      expect(toTimezoneOption(zone, JANUARY).abbreviation).not.toMatch(/GMT|\d/)
    }
  })

  it('prefers Intl, so a US zone is right for the season', () => {
    expect(toTimezoneOption('America/New_York', JANUARY).abbreviation).toBe('EST')
    expect(toTimezoneOption('America/New_York', JULY).abbreviation).toBe('EDT')
  })

  it('moves the offset with daylight saving', () => {
    expect(toTimezoneOption('Europe/London', JANUARY).offset).toBe('UTC+00:00')
    expect(toTimezoneOption('Europe/London', JULY).offset).toBe('UTC+01:00')
  })

  it('writes UTC as an offset, not as GMT', () => {
    const option = toTimezoneOption('UTC', JANUARY)
    expect(option.offset).toBe('UTC+00:00')
    expect(option.abbreviation).toBe('UTC')
  })

  describe('search', () => {
    const matches = (zone: string, term: string) =>
      toTimezoneOption(zone, JANUARY).searchText.includes(term.toLowerCase())

    it('finds a zone by its abbreviation: the reported bug', () => {
      expect(matches('Asia/Kolkata', 'IST')).toBe(true)
      expect(matches('Asia/Singapore', 'SGT')).toBe(true)
      expect(matches('America/Los_Angeles', 'PST')).toBe(true)
    })

    it('finds a zone by its city, without the region', () => {
      expect(matches('America/Los_Angeles', 'los angeles')).toBe(true)
      expect(matches('Asia/Kolkata', 'kolkata')).toBe(true)
    })

    it('finds a zone by offset, in either spelling', () => {
      expect(matches('Asia/Kolkata', '+05:30')).toBe(true)
      expect(matches('Asia/Kolkata', 'UTC+05:30')).toBe(true)
      expect(matches('Asia/Kolkata', 'GMT+05:30')).toBe(true)
    })

    it('finds a zone by its IANA name', () => {
      expect(matches('Europe/London', 'europe/london')).toBe(true)
    })
  })

  it('survives a zone the runtime has never heard of', () => {
    const option = toTimezoneOption('Mars/Olympus_Mons', JANUARY)
    expect(option.zone).toBe('Mars/Olympus_Mons')
    expect(option.offset).toBe('UTC+00:00')
    expect(option.searchText).toContain('olympus mons')
  })
})

describe('timezoneOptions', () => {
  it('keeps the order it was given', () => {
    const zones = ['UTC', 'Asia/Kolkata', 'Europe/London']
    expect(timezoneOptions(zones, JANUARY).map((option) => option.zone)).toEqual(zones)
  })
})

describe('IANA_TIMEZONES', () => {
  it('leads with UTC and keeps the alias Intl drops', () => {
    expect(IANA_TIMEZONES[0]).toBe('UTC')
    expect(IANA_TIMEZONES).toContain('Asia/Kolkata')
    expect(IANA_TIMEZONES).toContain('Asia/Calcutta')
  })
})

describe('timezoneChoices', () => {
  it('keeps a saved zone the catalogue does not list', () => {
    expect(timezoneChoices('Mars/Olympus_Mons', JANUARY)[0]?.zone).toBe('Mars/Olympus_Mons')
  })
})
