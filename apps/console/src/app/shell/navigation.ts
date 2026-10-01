import type { CountableId } from '@fp/query'
import type { ShellCrumb, ShellNavGroup, ShellNavItem } from '@fp/ui/compositions'

/**
 * The navigation tree.
 *
 * Twenty-four destinations, one level of nesting, in the arrangement the
 * current dashboard already uses: Product Catalog has seven children, Billing
 * six, Developers seven. Keeping the grouping means nobody has to relearn where
 * anything lives during the migration — the shell changed, the map did not.
 *
 * Paths are one flat segment each. The current dashboard nests them
 * (`/product-catalog/coupons`, `/billing/payments`), which buys nothing a
 * person can see and makes every URL longer than the thing it identifies.
 *
 * Icons are attached by the app rather than declared here, so this module stays
 * free of JSX and can be tested as data.
 */
export interface NavEntry {
  id: string
  label: string
  /** Absent for a parent: it expands, and clicking it goes to its first child. */
  path?: string
  children?: NavEntry[]
}

export const NAV: NavEntry[] = [
  { id: 'home', label: 'Home', path: '/' },
  {
    id: 'catalog',
    label: 'Product Catalog',
    children: [
      { id: 'features', label: 'Features', path: '/features' },
      { id: 'plans', label: 'Plans', path: '/plans' },
      { id: 'coupons', label: 'Coupons', path: '/coupons' },
      { id: 'addons', label: 'Addons', path: '/addons' },
      { id: 'cost-sheets', label: 'Cost Sheets', path: '/cost-sheets' },
      { id: 'price-units', label: 'Price Units', path: '/price-units' },
      { id: 'groups', label: 'Groups', path: '/groups' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    children: [
      { id: 'customers', label: 'Customers', path: '/customers' },
      { id: 'subscriptions', label: 'Subscriptions', path: '/subscriptions' },
      { id: 'invoices', label: 'Invoices', path: '/invoices' },
      { id: 'payments', label: 'Payments', path: '/payments' },
      { id: 'credit-notes', label: 'Credit Notes', path: '/credit-notes' },
      { id: 'taxes', label: 'Taxes', path: '/taxes' },
    ],
  },
  { id: 'revenue', label: 'Revenue', path: '/revenue' },
  {
    id: 'developers',
    label: 'Developers',
    children: [
      { id: 'events', label: 'Events Debugger', path: '/events' },
      { id: 'api-keys', label: 'API Keys', path: '/api-keys' },
      { id: 'service-accounts', label: 'Service Accounts', path: '/service-accounts' },
      { id: 'webhooks', label: 'Webhooks', path: '/webhooks' },
      { id: 'exports', label: 'Exports', path: '/exports' },
      { id: 'usage-syncs', label: 'Usage Syncs', path: '/usage-syncs' },
      { id: 'workflows', label: 'Workflows', path: '/workflows' },
    ],
  },
  { id: 'pricing-widget', label: 'Pricing Widget', path: '/pricing-widget' },
]

/**
 * Secondary destinations — Settings and Documentation.
 *
 * Separate from `NAV` because they are not part of the product's map — nobody
 * navigates the console by way of Settings. They are no longer rendered as a
 * "Quick links" sidebar group; Documentation now lives in the footer account
 * menu beside Settings. They stay here because they are still real routes, and
 * `pathForNavId`, `labelForNavId`, and `breadcrumbForPath` resolve against them.
 */
export const SECONDARY: NavEntry[] = [
  { id: 'settings', label: 'Settings', path: '/settings' },
  { id: 'docs', label: 'Documentation', path: '/docs' },
]

/** Every entry that can be navigated to, flattened. */
function leaves(entries: NavEntry[] = [...NAV, ...SECONDARY]): NavEntry[] {
  return entries.flatMap((entry) => [
    ...(entry.path ? [entry] : []),
    ...leaves(entry.children ?? []),
  ])
}

/**
 * Which entry a path belongs to.
 *
 * Longest match wins, so `/features/new` resolves to `features` rather than to
 * `/` — which would otherwise match everything.
 */
export function navEntryForPath(pathname: string): string | undefined {
  const match = leaves()
    .filter((entry) =>
      entry.path === '/' ? pathname === '/' : pathname.startsWith(entry.path ?? ''),
    )
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0]
  return match?.id
}

export function pathForNavId(id: string): string | undefined {
  return leaves().find((entry) => entry.id === id)?.path
}

export function labelForNavId(id: string): string | undefined {
  return [...NAV, ...SECONDARY]
    .flatMap((entry) => [entry, ...(entry.children ?? [])])
    .find((entry) => entry.id === id)?.label
}

/** A parent, if the entry has one. Drives both the breadcrumb and the counts. */
export function parentForNavId(id: string | undefined): NavEntry | undefined {
  if (!id) return undefined
  return NAV.find((entry) => (entry.children ?? []).some((child) => child.id === id))
}

/**
 * The crumbs for a path: the group, then the page.
 *
 * The group is not a link — it is a heading with no page of its own, and a
 * crumb that navigates somewhere the user did not name is worse than one that
 * does nothing.
 */
export function breadcrumbForPath(pathname: string): ShellCrumb[] {
  const id = navEntryForPath(pathname)
  if (!id) return []

  const label = labelForNavId(id)
  if (!label) return []

  const parent = parentForNavId(id)
  return parent ? [{ label: parent.label }, { label }] : [{ label }]
}

/**
 * Which entities to count, by the group that is open.
 *
 * Only the expanded group is counted — nobody needs the invoice count while
 * looking at the catalogue, and counting everything on every navigation would
 * be a dozen requests to render a sidebar.
 */
export const GROUP_COUNTS: Record<string, readonly CountableId[]> = {
  catalog: ['features', 'plans'],
  billing: ['customers', 'invoices', 'subscriptions'],
}

/** The group an entry sits in, so its counts can be fetched. */
export function groupForNavId(id: string | undefined): string | undefined {
  if (!id) return undefined
  return NAV.find(
    (entry) => entry.id === id || (entry.children ?? []).some((child) => child.id === id),
  )?.id
}

function toItems(
  entries: NavEntry[],
  icons: Record<string, React.ReactNode>,
  counts: Partial<Record<string, number>>,
): ShellNavItem[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    ...(icons[entry.id] ? { icon: icons[entry.id] } : {}),
    ...(counts[entry.id] !== undefined ? { count: counts[entry.id] } : {}),
    ...(entry.children ? { items: toItems(entry.children, {}, counts) } : {}),
  }))
}

/** Builds what the shell renders. Counts come from the app. */
export function toNavGroups(
  icons: Record<string, React.ReactNode> = {},
  counts: Partial<Record<string, number>> = {},
): ShellNavGroup[] {
  // The single primary tree, with no group heading. A lone group needs no label
  // — "Workspace" over the only section on screen named the obvious and cost a
  // row of vertical space at the top of the rail. The former "Quick links" group
  // (Settings + Documentation, from `SECONDARY`) is likewise gone: both now live
  // in the footer account menu. `SECONDARY` remains for route resolution — see
  // the note on that constant.
  return [{ id: 'main', items: toItems(NAV, icons, counts) }]
}
