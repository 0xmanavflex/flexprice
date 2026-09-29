/**
 * The information architecture of Settings, as data.
 *
 * Two levels — a section rail and a tab strip inside it — and both are declared
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
 * that is merely unfinished. Every one of them is backed by
 * `GET/PUT/DELETE /settings/:key` in the backend, and `settings.go` carries
 * swagger annotations on none of its three handlers — so the route is absent
 * from the OpenAPI document, absent from `@flexprice/sdk` (there is no
 * `settings` module at all), and therefore absent from `@fp/query`, which says
 * so in its own index.
 *
 * The tab stays listed and stays selectable, because "you cannot get there" and
 * "there is nothing there yet" look identical from outside and only one of them
 * is true. What it renders is `SettingsUnavailable`, which names the missing
 * contract rather than promising a date.
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
}

export const SETTINGS_SECTIONS = [
  {
    id: 'organization',
    label: 'Organization',
    tabs: [
      { id: 'profile', label: 'Profile' },
      { id: 'plan', label: 'Plan & usage' },
      { id: 'environments', label: 'Environments' },
    ],
  },
  {
    id: 'team',
    label: 'Team & access',
    tabs: [
      { id: 'members', label: 'Members' },
      { id: 'roles', label: 'Roles & permissions' },
      { id: 'sso', label: 'Single sign-on', unavailable: true },
    ],
  },
  {
    id: 'billing',
    label: 'Billing configuration',
    tabs: [
      { id: 'invoices', label: 'Invoices', unavailable: true },
      { id: 'subscriptions', label: 'Subscriptions', unavailable: true },
      { id: 'currencies', label: 'Currencies', unavailable: true },
      { id: 'taxes', label: 'Taxes' },
    ],
  },
  {
    id: 'customer-experience',
    label: 'Customer experience',
    tabs: [
      { id: 'portal', label: 'Portal', unavailable: true },
      { id: 'onboarding', label: 'Onboarding', unavailable: true },
    ],
  },
  {
    id: 'developers',
    label: 'Developers',
    tabs: [
      { id: 'api-keys', label: 'API keys' },
      { id: 'service-accounts', label: 'Service accounts' },
      { id: 'webhooks', label: 'Webhooks', unavailable: true },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications & alerts',
    tabs: [
      { id: 'alert-rules', label: 'Alert rules' },
      { id: 'wallet-alerts', label: 'Wallet alerts', unavailable: true },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    tabs: [{ id: 'theme', label: 'Theme' }],
  },
] as const satisfies readonly SettingsSectionSpec[]

/** The section a bad or absent `?section=` falls back to. */
export const DEFAULT_SECTION: SettingsSectionSpec = SETTINGS_SECTIONS[0]

export function findSettingsSection(id: string): SettingsSectionSpec | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id)
}

/**
 * The tab a section opens on.
 *
 * `SettingsShell` reports a section change and nothing else — it cannot know
 * which tab the new section should land on — so the page reads this and writes
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
