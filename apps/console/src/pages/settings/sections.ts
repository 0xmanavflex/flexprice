/**
 * The information architecture of Settings, as data.
 *
 * Two levels: a section rail and a tab strip inside it: and both are declared
 * here rather than in the page, for the same reason `placeholderRoutes.ts`
 * exists: the shape of the screen is a list somebody maintains, and a list in
 * one place can be read, tested and linked against. The URL codec
 * (`app/settingsSearch.ts`) validates against this table, the page renders from
 * it, and a tab that is not in it is not reachable.
 *
 * Deliberately free of JSX so the codec's test does not pull React in. The
 * section icons are attached by id in `SettingsPage`.
 *
 * ## `unavailable`
 *
 * A tab marked `unavailable` is one this console cannot build honestly, not one
 * that is merely unfinished. None qualifies today: Single sign-on, the last one,
 * was removed from Team along with Roles & permissions. The flag and
 * `SettingsUnavailable` stay so the next tab that cannot be built honestly has
 * somewhere to say so.
 *
 * Absent from the generated SDK and absent from the server are different
 * claims: `/settings/:key` answers 200 in production and `@fp/api`'s
 * `settings.ts` reaches it with `fetch`: and only the second makes a tab
 * unavailable.
 *
 * A listed unavailable tab stays selectable, because "you cannot get there"
 * and "there is nothing there yet" look identical from outside and only one of
 * them is true.
 */
export interface SettingsTabSpec {
  id: string
  label: string
  /** No API contract behind it. `SettingsUnavailable` says which one is missing. */
  unavailable?: true
}

export interface SettingsSectionSpec {
  id: string
  label: string
  tabs: readonly SettingsTabSpec[]
  /**
   * A row that opens a page of its own (Discounts, Taxes, Cost tracking)
   * instead of a panel here. It has no tabs and is never the open
   * section.
   */
  href?: string
  /** Reachable by URL and from elsewhere in the console, but not a row in the rail. */
  hidden?: true
}

/**
 * The rail, top to bottom: one flat list, no groups and no nesting. A section
 * with more than one tab shows them as a strip above its content.
 */
export const SETTINGS_SECTIONS = [
  {
    id: 'team',
    label: 'Team',
    tabs: [
      // The tab id stays `members` so old links keep landing here.
      { id: 'members', label: 'Team' },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    // One page, no tab bar: only the organisation's profile.
    tabs: [{ id: 'profile', label: 'Profile' }],
  },
  {
    // The tenant's own Flexprice account: plan, usage, invoices.
    id: 'usage-billing',
    label: 'Usage & billing',
    href: '/settings/usage-billing',
    tabs: [],
  },
  {
    id: 'discounts',
    label: 'Coupons',
    href: '/coupons',
    tabs: [],
  },
  {
    id: 'taxes',
    label: 'Taxes',
    href: '/taxes',
    tabs: [],
  },
  {
    id: 'cost-tracking',
    label: 'Cost tracking',
    href: '/cost-sheets',
    tabs: [],
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    tabs: [
      { id: 'invoices', label: 'Invoices' },
      { id: 'tax', label: 'Tax engine' },
    ],
  },
  {
    id: 'subscription',
    label: 'Contract',
    tabs: [{ id: 'subscriptions', label: 'Contracts' }],
  },
  {
    id: 'currency',
    label: 'Currency',
    tabs: [
      { id: 'currencies', label: 'Currencies' },
      { id: 'forex', label: 'Forex rates' },
    ],
  },
  {
    id: 'alerts',
    label: 'Wallet alerts',
    tabs: [{ id: 'wallet-alerts', label: 'Wallet alerts' }],
  },
  {
    id: 'tags',
    label: 'Tags',
    tabs: [{ id: 'tags', label: 'Tags' }],
  },
  {
    id: 'customer-experience',
    label: 'Customer experience',
    tabs: [
      { id: 'portal', label: 'Portal' },
      { id: 'onboarding', label: 'Onboarding' },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    tabs: [{ id: 'theme', label: 'Theme' }],
  },
] as const satisfies readonly SettingsSectionSpec[]

/**
 * Section ids that used to exist, and where they live now.
 *
 * Labels became Tags; the old id keeps resolving so a bookmark or a link in
 * somebody's notes still lands on the right table.
 */
export const SECTION_ALIASES: Readonly<Record<string, { section: string; tab: string }>> = {
  labels: { section: 'tags', tab: 'tags' },
  groups: { section: 'tags', tab: 'tags' },
}

/**
 * Sections that moved out of Settings to a page of their own, under the
 * Developers area of the nav.
 */
export const MOVED_SECTIONS: Readonly<Record<string, string>> = {
  'api-keys': '/api-keys',
  'service-accounts': '/service-accounts',
  webhooks: '/webhooks',
}

/** The section a bad or absent `?section=` falls back to. */
export const DEFAULT_SECTION: SettingsSectionSpec = SETTINGS_SECTIONS[0]

/** A section that has panels here, as opposed to a row that links to another page. */
export function findSettingsSection(id: string): SettingsSectionSpec | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id && !('href' in section))
}

/** The rail's rows, in order. */
export const RAIL_SECTIONS: readonly SettingsSectionSpec[] = SETTINGS_SECTIONS.filter(
  (section) => !('hidden' in section),
)

/**
 * The tab a section opens on.
 *
 * `SettingsShell` reports a section change and nothing else: it cannot know
 * which tab the new section should land on: so the page reads this and writes
 * both ids into one history entry.
 *
 * Total rather than asserting: every section in the table above has at least
 * one tab, and the type cannot say so.
 */
export function firstTabOf(section: SettingsSectionSpec): SettingsTabSpec {
  return section.tabs[0] ?? { id: '', label: '' }
}

export function findSettingsTab(
  section: SettingsSectionSpec,
  tabId: string,
): SettingsTabSpec | undefined {
  return section.tabs.find((tab) => tab.id === tabId)
}
