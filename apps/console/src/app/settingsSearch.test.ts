import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS_QUERY, parseSettingsSearch } from './settingsSearch'
import { SETTINGS_SECTIONS, type SettingsSectionSpec } from '../pages/settings/sections'

/*
 * Widened from the `as const` tuple to the interface. The literal type of each
 * tab omits `unavailable` where it is absent, so reading that property off the
 * tuple is a type error even though the value is simply undefined.
 */
const SECTIONS: readonly SettingsSectionSpec[] = SETTINGS_SECTIONS

describe('parseSettingsSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseSettingsSearch({})).toEqual(DEFAULT_SETTINGS_QUERY)
    expect(DEFAULT_SETTINGS_QUERY).toEqual({ section: 'team', tab: 'members' })
  })

  it('reads a full pair', () => {
    expect(parseSettingsSearch({ section: 'customer-experience', tab: 'onboarding' })).toEqual({
      section: 'customer-experience',
      tab: 'onboarding',
    })
  })

  it('opens a section on its own first tab when no tab is named', () => {
    expect(parseSettingsSearch({ section: 'customer-experience' })).toEqual({
      section: 'customer-experience',
      tab: 'portal',
    })
  })

  // The one worth naming: two ids that are each real but do not go together,
  // which is what a half-rewritten link looks like.
  it('falls back when the tab belongs to another section', () => {
    expect(parseSettingsSearch({ section: 'customer-experience', tab: 'members' })).toEqual({
      section: 'customer-experience',
      tab: 'portal',
    })
  })

  it('sends the old Labels ids to Tags', () => {
    expect(parseSettingsSearch({ section: 'labels', tab: 'labels' })).toEqual({
      section: 'tags',
      tab: 'tags',
    })
    expect(parseSettingsSearch({ section: 'groups' })).toEqual({
      section: 'tags',
      tab: 'tags',
    })
  })

  it('opens Wallet alerts on its only tab now that Alert rules is gone', () => {
    expect(parseSettingsSearch({ section: 'alerts', tab: 'alert-rules' })).toEqual({
      section: 'alerts',
      tab: 'wallet-alerts',
    })
  })

  it('keeps API keys, service accounts and environments out of Settings', () => {
    expect(parseSettingsSearch({ section: 'api-keys' })).toEqual(DEFAULT_SETTINGS_QUERY)
    expect(parseSettingsSearch({ section: 'service-accounts' })).toEqual(DEFAULT_SETTINGS_QUERY)
    expect(parseSettingsSearch({ section: 'organization', tab: 'environments' })).toEqual({
      section: 'organization',
      tab: 'profile',
    })
  })

  it('sends the removed Roles and Single sign-on tabs to Team', () => {
    for (const tab of ['roles', 'sso']) {
      expect(parseSettingsSearch({ section: 'team', tab })).toEqual({
        section: 'team',
        tab: 'members',
      })
    }
  })

  it('gives Team a single tab, so no tab strip is drawn for it', () => {
    expect(SECTIONS.find((section) => section.id === 'team')?.tabs.map((tab) => tab.id)).toEqual([
      'members',
    ])
  })

  it.each([
    ['an unknown section', { section: 'nonsense' }],
    ['an unknown tab', { section: 'team', tab: 'nonsense' }],
    ['both unknown', { section: 'nonsense', tab: 'nonsense' }],
    ['nulls', { section: null, tab: null }],
    ['numbers', { section: 7, tab: 9 }],
    ['repeated params', { section: ['team', 'alerts'], tab: ['members'] }],
    ['an empty string', { section: '', tab: '' }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseSettingsSearch(raw as Record<string, unknown>)).not.toThrow()
    const parsed = parseSettingsSearch(raw as Record<string, unknown>)
    const section = SECTIONS.find((entry) => entry.id === parsed.section)
    expect(section, `${parsed.section} is not a section`).toBeDefined()
    expect(section?.tabs.some((tab) => tab.id === parsed.tab)).toBe(true)
  })

  it('does not open a row that links to a page of its own', () => {
    expect(parseSettingsSearch({ section: 'discounts' })).toEqual(DEFAULT_SETTINGS_QUERY)
  })

  it('reads a repeated param as its first value', () => {
    expect(parseSettingsSearch({ section: ['team', 'alerts'] }).section).toBe('team')
  })

  // Parsing its own output must be a fixed point, or a reload moves the user.
  it('is stable across a parse of its own output', () => {
    for (const section of SECTIONS) {
      for (const tab of section.tabs) {
        const once = parseSettingsSearch({ section: section.id, tab: tab.id })
        expect(once).toEqual({ section: section.id, tab: tab.id })
        expect(parseSettingsSearch({ ...once })).toEqual(once)
      }
    }
  })
})

describe('the settings table itself', () => {
  it('has a unique id for every section', () => {
    const ids = SECTIONS.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every section with panels at least one tab, and every link row none', () => {
    for (const section of SECTIONS.filter((entry) => entry.href)) {
      expect(section.tabs, section.id).toHaveLength(0)
    }
    for (const section of SECTIONS.filter((entry) => !entry.href)) {
      expect(section.tabs.length, section.id).toBeGreaterThan(0)
      const ids = section.tabs.map((tab) => tab.id)
      expect(new Set(ids).size, section.id).toBe(ids.length)
    }
  })

  /**
   * The unavailable set, pinned.
   *
   * Empty since Single sign-on left Team. A tab quietly *added* to this list is
   * a capability somebody gave up on, and this test makes that a visible diff
   * rather than a silent one.
   */
  it('marks no tab unavailable', () => {
    const unavailable = SECTIONS.flatMap((section) =>
      section.tabs.filter((tab) => tab.unavailable).map((tab) => `${section.id}/${tab.id}`),
    )

    expect(unavailable).toEqual([])
  })
})
