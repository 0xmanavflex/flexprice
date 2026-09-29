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
    expect(DEFAULT_SETTINGS_QUERY).toEqual({ section: 'organization', tab: 'profile' })
  })

  it('reads a full pair', () => {
    expect(parseSettingsSearch({ section: 'developers', tab: 'service-accounts' })).toEqual({
      section: 'developers',
      tab: 'service-accounts',
    })
  })

  it('opens a section on its own first tab when no tab is named', () => {
    expect(parseSettingsSearch({ section: 'notifications' })).toEqual({
      section: 'notifications',
      tab: 'alert-rules',
    })
  })

  // The one worth naming: two ids that are each real but do not go together,
  // which is what a half-rewritten link looks like.
  it('falls back when the tab belongs to another section', () => {
    expect(parseSettingsSearch({ section: 'developers', tab: 'members' })).toEqual({
      section: 'developers',
      tab: 'api-keys',
    })
  })

  it('keeps an unavailable tab — it is listed, selectable and linkable', () => {
    expect(parseSettingsSearch({ section: 'team', tab: 'sso' })).toEqual({
      section: 'team',
      tab: 'sso',
    })
  })

  it.each([
    ['an unknown section', { section: 'nonsense' }],
    ['an unknown tab', { section: 'team', tab: 'nonsense' }],
    ['both unknown', { section: 'nonsense', tab: 'nonsense' }],
    ['nulls', { section: null, tab: null }],
    ['numbers', { section: 7, tab: 9 }],
    ['repeated params', { section: ['team', 'developers'], tab: ['members'] }],
    ['an empty string', { section: '', tab: '' }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseSettingsSearch(raw as Record<string, unknown>)).not.toThrow()
    const parsed = parseSettingsSearch(raw as Record<string, unknown>)
    const section = SECTIONS.find((entry) => entry.id === parsed.section)
    expect(section, `${parsed.section} is not a section`).toBeDefined()
    expect(section?.tabs.some((tab) => tab.id === parsed.tab)).toBe(true)
  })

  it('reads a repeated param as its first value', () => {
    expect(parseSettingsSearch({ section: ['team', 'developers'] }).section).toBe('team')
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

  it('gives every section at least one tab, with unique ids inside it', () => {
    for (const section of SECTIONS) {
      expect(section.tabs.length, section.id).toBeGreaterThan(0)
      const ids = section.tabs.map((tab) => tab.id)
      expect(new Set(ids).size, section.id).toBe(ids.length)
    }
  })

  /**
   * The unavailable set, pinned.
   *
   * Every id here is a capability behind `GET/PUT/DELETE /settings/:key`, which
   * has no swagger annotations and so no SDK module. The list shrinks when that
   * contract lands — and a tab quietly *added* to it is a capability somebody
   * gave up on, which should be a visible diff rather than a silent one.
   */
  it('marks exactly the tabs with no backend contract', () => {
    const unavailable = SECTIONS.flatMap((section) =>
      section.tabs.filter((tab) => tab.unavailable).map((tab) => `${section.id}/${tab.id}`),
    )

    expect(unavailable).toEqual([
      'team/sso',
      'billing/invoices',
      'billing/subscriptions',
      'billing/currencies',
      'customer-experience/portal',
      'customer-experience/onboarding',
      'developers/webhooks',
      'notifications/wallet-alerts',
    ])
  })
})
