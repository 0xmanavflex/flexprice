import type { ShellCrumb, ShellNavGroup, ShellNavItem } from '@fp/ui/compositions'

/**
 * The navigation tree.
 *
 * The primary tree follows the revenue lifecycle: who you bill (Customers),
 * what you sell them (Product catalog), what they signed (Contracts), what you
 * bill and collect, what it earned (Revenue), and how it is wired
 * (Developers). Integrations and Documentation sit apart, pinned under a rule
 * at the foot of the rail, because nobody works *in* them.
 *
 * Destinations the design marks v2.1 (Reports, Revenue's sub-reports, Billing &
 * Usage) are left out until they exist; a placeholder row is a dead end with a
 * label.
 *
 * Paths are one flat segment each. A row that is a tab of the Settings page
 * (Tags) carries the `query` that selects it, so it highlights and deep-links
 * like any other row.
 *
 * Icons are attached by the app rather than declared here, so this module stays
 * free of JSX and can be tested as data.
 */
export interface NavEntry {
  id: string
  label: string
  /** Absent for a parent: it expands, and clicking it goes to its first child. */
  path?: string
  /** A page outside the console: the row is a link that opens it in a new tab. */
  external?: string
  /** Search params that select this row on a page shared with others (Settings tabs). */
  query?: Record<string, string>
  /** Which `query` keys decide whether the row is active. Defaults to all of them. */
  match?: readonly string[]
  children?: NavEntry[]
}

/** Flexprice's own documentation, where the Documentation row sends you. */
export const DOCS_URL = 'https://docs.flexprice.io/docs/welcome-to-flexprice'

export const NAV: NavEntry[] = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'customers', label: 'Customers', path: '/customers' },
  {
    id: 'catalog',
    label: 'Product catalog',
    children: [
      // Plan, then Feature, then Add-on: the order the catalogue is built and read in.
      { id: 'plans', label: 'Plans', path: '/plans' },
      { id: 'features', label: 'Features', path: '/features' },
      { id: 'addons', label: 'Add-ons', path: '/addons' },
      { id: 'pricing-widget', label: 'Pricing widgets', path: '/pricing-widget' },
    ],
  },
  { id: 'subscriptions', label: 'Contracts', path: '/contracts' },
  {
    id: 'billing',
    label: 'Billing',
    children: [
      { id: 'invoices', label: 'Invoices', path: '/invoices' },
      { id: 'credit-notes', label: 'Credit memos', path: '/credit-memos' },
    ],
  },
  {
    id: 'collections',
    label: 'Collections',
    children: [{ id: 'payments', label: 'Payments', path: '/payments' }],
  },
  { id: 'reports', label: 'Reports', path: '/reports' },
  {
    id: 'developers',
    label: 'Developers',
    children: [
      // Events debugger leads: it is where a developer starts. API keys sit beside it.
      { id: 'events', label: 'Events debugger', path: '/events' },
      { id: 'api-keys', label: 'API keys', path: '/api-keys' },
      { id: 'service-accounts', label: 'Service accounts', path: '/service-accounts' },
      { id: 'webhooks', label: 'Webhooks', path: '/webhooks' },
      { id: 'usage-syncs', label: 'Usage sync', path: '/usage-syncs' },
      { id: 'exports', label: 'Exports', path: '/exports' },
      { id: 'workflows', label: 'Workflows', path: '/workflows' },
    ],
  },
]

/**
 * The foot of the rail: Integrations and Documentation.
 *
 * Both are places you visit rather than work in, so they sit apart under a
 * rule. Settings is not in the rail at all: it lives in the account menu, next
 * to sign out.
 */
export const FOOTER_NAV: NavEntry[] = [
  { id: 'integrations', label: 'Integrations', path: '/integrations' },
  { id: 'docs', label: 'Documentation', external: DOCS_URL },
]

/**
 * Destinations that are real routes but not rows in the rail.
 *
 * Settings itself (reached from the account menu), the pages it lists but which keep their own routes (Discounts, Taxes,
 * Cost Tracking), Tags (a Settings tab), and the pages the tree no longer lists but which are
 * still linked to, searched for and reachable by URL. `pathForNavId`,
 * `labelForNavId`, `breadcrumbForPath` and the command palette resolve against
 * them.
 */
export const SECONDARY: NavEntry[] = [
  { id: 'settings', label: 'Settings', path: '/settings' },
  { id: 'settings-usage-billing', label: 'Usage & billing', path: '/settings/usage-billing' },
  // The page Stripe Checkout returns to belongs to Usage & billing, not to the Billing area.
  { id: 'settings-usage-billing-checkout', label: 'Usage & billing', path: '/billing/checkout' },
  { id: 'settings-discounts', label: 'Coupons', path: '/coupons' },
  { id: 'settings-taxes', label: 'Taxes', path: '/taxes' },
  { id: 'settings-cost-tracking', label: 'Cost Tracking', path: '/cost-sheets' },
  {
    id: 'settings-tags',
    label: 'Tags',
    path: '/settings',
    query: { section: 'tags', tab: 'tags' },
  },
  { id: 'price-units', label: 'Price Units', path: '/price-units' },
]

const ALL: NavEntry[] = [...NAV, ...FOOTER_NAV, ...SECONDARY]

/** Every entry that can be navigated to, flattened. */
function leaves(entries: NavEntry[] = ALL): NavEntry[] {
  return entries.flatMap((entry) => [
    ...(entry.path ? [entry] : []),
    ...leaves(entry.children ?? []),
  ])
}

/**
 * Which entry a path belongs to.
 *
 * Longest match wins, so `/features/new` resolves to `features` rather than to
 * `/`: which would otherwise match everything. A row that selects a Settings
 * tab also has to match the search, and beats the bare `/settings` row when it
 * does. `search` is a query string, with or without the leading `?`.
 */
export function navEntryForPath(pathname: string, search = ''): string | undefined {
  const params = new URLSearchParams(search)
  const score = (entry: NavEntry): number => {
    const path = entry.path ?? ''
    if (
      path === '/'
        ? pathname !== '/'
        : !(pathname === path || pathname.startsWith(`${path}/`) || pathname.startsWith(`${path}?`))
    )
      return -1
    if (!entry.query) return path.length * 10
    const keys = entry.match ?? Object.keys(entry.query)
    return keys.every((key) => params.get(key) === entry.query?.[key])
      ? path.length * 10 + keys.length
      : -1
  }
  let best: { id: string; score: number } | undefined
  for (const entry of leaves()) {
    const value = score(entry)
    if (value >= 0 && (!best || value > best.score)) best = { id: entry.id, score: value }
  }
  return best?.id
}

/** The link for an entry: its path, with the search that selects it. */
export function hrefForNavId(id: string): string | undefined {
  const entry = [...leaves(), ...ALL.filter((candidate) => candidate.external)].find(
    (candidate) => candidate.id === id,
  )
  if (entry?.external) return entry.external
  if (!entry?.path) return undefined
  return entry.query ? `${entry.path}?${new URLSearchParams(entry.query).toString()}` : entry.path
}

export function pathForNavId(id: string): string | undefined {
  return leaves().find((entry) => entry.id === id)?.path
}

export function labelForNavId(id: string): string | undefined {
  return ALL.flatMap((entry) => [entry, ...(entry.children ?? [])]).find((entry) => entry.id === id)
    ?.label
}

/** A parent, if the entry has one. Drives the breadcrumb. */
export function parentForNavId(id: string | undefined): NavEntry | undefined {
  if (!id) return undefined
  // Discounts, Taxes, Cost Tracking and Tags are rows of Settings that keep their own routes.
  if (id.startsWith('settings-'))
    return SECONDARY.find((entry) => entry.id === 'settings')
  return [...NAV, ...FOOTER_NAV].find((entry) =>
    (entry.children ?? []).some((child) => child.id === id),
  )
}

/**
 * The crumbs for a path: the group, then the page.
 *
 * The group is not a link: it is a heading with no page of its own, and a
 * crumb that navigates somewhere the user did not name is worse than one that
 * does nothing.
 */
export function breadcrumbForPath(pathname: string, search = ''): ShellCrumb[] {
  const id = navEntryForPath(pathname, search)
  if (!id) return []

  const label = labelForNavId(id)
  if (!label) return []

  const parent = parentForNavId(id)
  return parent ? [{ label: parent.label }, { label }] : [{ label }]
}

function toItems(entries: NavEntry[], icons: Record<string, React.ReactNode>): ShellNavItem[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    ...(icons[entry.id] ? { icon: icons[entry.id] } : {}),
    ...(entry.external ? { href: entry.external } : {}),
    ...(entry.children ? { items: toItems(entry.children, {}) } : {}),
  }))
}

/** Builds what the shell renders. */
export function toNavGroups(icons: Record<string, React.ReactNode> = {}): ShellNavGroup[] {
  // The primary tree carries no heading: a lone label over the main section
  // names the obvious. The footer group is pinned to the bottom of the rail.
  return [
    { id: 'main', items: toItems(NAV, icons) },
    { id: 'footer', pinned: true, items: toItems(FOOTER_NAV, icons) },
  ]
}
