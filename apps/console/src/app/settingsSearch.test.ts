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
    expect(parseSettingsSearch({ section: 'service-accounts', tab: 'service-accounts' })).toEqual({
      section: 'service-accounts',
      tab: 'service-accounts',
    })
  })

  it('opens a section on its own first tab when no tab is named', () => {
    expect(parseSettingsSearch({ section: 'alerts' })).toEqual({
      section: 'alerts',
      tab: 'alert-rules',
    })
  })

  // The one worth naming: two ids that are each real but do not go together,
  // which is what a half-rewritten link looks like.
  it('falls back when the tab belongs to another section', () => {
    expect(parseSettingsSearch({ section: 'alerts', tab: 'members' })).toEqual({
      section: 'alerts',
      tab: 'alert-rules',
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
   * It holds exactly one id, and shrinking it to that took undoing a wrong
   * conclusion. All eight of these were once listed as having "no backend
   * contract", reasoning from `settings.go` being unannotated to the routes
   * being unreachable. They answer 200 in production; only the generated SDK
   * was missing them, and `@fp/api/settings.ts` reaches them with `fetch`.
   *
   * What is left is `team/sso`, and its absence is real but different in kind:
   * the deployment answers 404 "SAML single sign-on is not available on this
   * deployment". Switched off, not undocumented.
   *
   * A tab quietly *added* to this list is a capability somebody gave up on, and
   * this test exists to make that a visible diff rather than a silent one —
   * which is precisely how it caught the seven that never belonged.
   */
  it('marks only the capability this deployment has switched off', () => {
    const unavailable = SECTIONS.flatMap((section) =>
      section.tabs.filter((tab) => tab.unavailable).map((tab) => `${section.id}/${tab.id}`),
    )

    expect(unavailable).toEqual(['team/sso'])
  })
})
