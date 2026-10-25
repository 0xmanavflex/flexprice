import {
  DEFAULT_SECTION,
  SECTION_ALIASES,
  findSettingsSection,
  findSettingsTab,
  firstTabOf,
} from '../pages/settings/sections'

/**
 * Which settings section and tab are open, as URL search params.
 *
 * `/settings?section=<id>&tab=<id>`. Both levels are in the address bar, not
 * just the outer one, because every surface in this app is URL-backed and a
 * two-level navigation whose inner level lives in component state produces a
 * link that lands somebody one level short of where they were pointed.
 *
 * Same rule as `planSearch.ts`: parsing is **total**. A hand-edited or stale
 * URL resolves to something real rather than throwing or rendering a blank
 * panel, and it resolves in a specific order:
 *
 *   1. An unknown or absent `section` falls back to the first section.
 *   2. An unknown or absent `tab` falls back to that section's first tab.
 *   3. A `tab` that is real but **belongs to a different section** also falls
 *      back. This is the case worth naming: `?section=developers&tab=members`
 *      is two valid ids that do not go together, and it is what a
 *      half-rewritten link looks like. Resolving the tab against the resolved
 *      section rather than against the whole table is what makes the pair
 *      always consistent.
 *
 * Because the tab is resolved against the section, the output is a fixed point
 *: parsing it again returns it unchanged: which is what keeps a reload from
 * moving the user.
 */
export interface SettingsQuery {
  section: string
  tab: string
}

/**
 * The pair `/settings` means with nothing in the query string.
 *
 * Handed to `stripSearchParams` on the route so the default pair stays out of
 * the address bar, exactly as the list routes keep their default query out of
 * it: `/settings` rather than `/settings?section=organization&tab=profile`.
 */
export const DEFAULT_SETTINGS_QUERY: SettingsQuery = {
  section: DEFAULT_SECTION.id,
  tab: firstTabOf(DEFAULT_SECTION).id,
}

/** A param as a trimmed string, whatever the router handed us. */
function text(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return text(value[0])
  return String(value).trim()
}

export function parseSettingsSearch(raw: Record<string, unknown>): SettingsQuery {
  // A renamed section (Labels → Tags) lands where it lives now.
  const alias = SECTION_ALIASES[text(raw['section'])]
  if (alias) return { section: alias.section, tab: alias.tab }

  const section = findSettingsSection(text(raw['section'])) ?? DEFAULT_SECTION
  const tab = findSettingsTab(section, text(raw['tab'])) ?? firstTabOf(section)

  return { section: section.id, tab: tab.id }
}
