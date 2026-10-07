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
 * that is merely unfinished. Exactly one qualifies today: **Single sign-on**.
 *
 * `GET /settings/saml_config` answers `404 {"code":"not_found","message":"SAML
 * single sign-on is not available on this deployment"}`. That is the deployment
 * saying SSO is switched off, not a contract we are missing — so there is
 * nothing to render and nothing to save, and `useSamlConfig` deliberately
 * treats *any* read failure the same way. V1 learned that one the hard way: a
 * 500 rendering an empty SSO form lets the next Save wipe a live config and
 * lock a tenant out of their own dashboard.
 *
 * Everything else on this page used to carry this flag, on the belief that
 * `/settings/:key` was unreachable because `settings.go` is unannotated and the
 * generated SDK therefore has no `settings` module. The SDK part is true; the
 * conclusion was not. The routes exist and answer 200 in production, so
 * `@fp/api`'s `settings.ts` reaches them with `fetch`, exactly as `session.ts`
 * already does for the four undocumented auth routes. Absent from the contract
 * and absent from the server are different claims, and only the first one held.
 *
 * The tab stays listed and stays selectable, because "you cannot get there" and
 * "there is nothing there yet" look identical from outside and only one of them
 * is true.
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
  /** One sentence under the section's title. */
  description?: string
  tabs: readonly SettingsTabSpec[]
  /**
   * A row that opens a page of its own (Discounts, Taxes, Cost tracking,
   * Labels) instead of a panel here. It has no tabs and is never the open
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
    description: 'The people who can sign in, and what they can do.',
    tabs: [
      { id: 'members', label: 'Members' },
      { id: 'roles', label: 'Roles & permissions' },
      { id: 'sso', label: 'Single sign-on', unavailable: true },
    ],
  },
  {
    id: 'discounts',
    label: 'Discounts',
    description: 'Coupons you can apply to contracts and invoices.',
    href: '/coupons',
    tabs: [],
  },
  {
    id: 'taxes',
    label: 'Taxes',
    description: 'Tax rates applied to invoices.',
    href: '/taxes',
    tabs: [],
  },
  {
    id: 'cost-tracking',
    label: 'Cost tracking',
    description: 'What each product costs you, for margin reporting.',
    href: '/cost-sheets',
    tabs: [],
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    description: 'What goes on every invoice, how it is numbered and when it is finalized.',
    tabs: [{ id: 'invoices', label: 'Invoices' }],
  },
  {
    id: 'subscription',
    label: 'Contract',
    description: 'What happens to a contract when its invoices go unpaid.',
    tabs: [{ id: 'subscriptions', label: 'Contracts' }],
  },
  {
    id: 'currency',
    label: 'Currency',
    description: 'Fiat currencies you invoice in, and custom ones like credits.',
    tabs: [{ id: 'currencies', label: 'Currencies' }],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    description: 'When Flexprice warns you about wallet balances and usage.',
    tabs: [
      { id: 'alert-rules', label: 'Alert rules' },
      { id: 'wallet-alerts', label: 'Wallet alerts' },
    ],
  },
  {
    id: 'labels',
    label: 'Labels',
    description: 'Group products and charges for reporting and filters.',
    href: '/labels',
    tabs: [],
  },
  {
    id: 'customer-experience',
    label: 'Customer experience',
    description: 'What your customers see in their billing portal, in what order, in your colours.',
    tabs: [
      { id: 'portal', label: 'Portal' },
      { id: 'onboarding', label: 'Onboarding' },
    ],
  },
  {
    id: 'api-keys',
    label: 'API keys',
    description: 'Keys your servers use to call the Flexprice API.',
    tabs: [{ id: 'api-keys', label: 'API keys' }],
  },
  {
    id: 'service-accounts',
    label: 'Service accounts',
    description: 'Non-human identities with scoped access.',
    tabs: [{ id: 'service-accounts', label: 'Service accounts' }],
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    hidden: true,
    tabs: [{ id: 'webhooks', label: 'Webhooks' }],
  },
  {
    id: 'organization',
    label: 'Organization',
    hidden: true,
    tabs: [
      { id: 'profile', label: 'Profile' },
      { id: 'plan', label: 'Plan & usage' },
      { id: 'environments', label: 'Environments' },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    hidden: true,
    tabs: [{ id: 'theme', label: 'Theme' }],
  },
] as const satisfies readonly SettingsSectionSpec[]

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
