import type { CountableId } from '@fp/query'
import type { ShellNavGroup } from '@fp/ui/compositions'

/**
 * The navigation tree.
 *
 * One flat group with one level of nesting, which is what the product needs:
 * Product Catalog has seven children, Billing six, Developers seven. The shape
 * mirrors the dashboard people already use, so nobody has to relearn where
 * anything lives.
 *
 * Icons are attached by the app rather than declared here, so this module stays
 * free of JSX and can be tested as data.
 */
export interface NavEntry {
  id: string
  label: string
  /** Absent for a parent: it expands rather than navigating somewhere of its own. */
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
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    children: [
      { id: 'customers', label: 'Customers', path: '/customers' },
      { id: 'invoices', label: 'Invoices', path: '/invoices' },
      { id: 'subscriptions', label: 'Subscriptions', path: '/subscriptions' },
    ],
  },
  { id: 'revenue', label: 'Revenue', path: '/revenue' },
  { id: 'developers', label: 'Developers', path: '/developers' },
  { id: 'settings', label: 'Settings', path: '/settings' },
]

/** Every entry that can be navigated to, flattened. */
function leaves(entries: NavEntry[] = NAV): NavEntry[] {
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
    .filter((entry) => entry.path === '/' ? pathname === '/' : pathname.startsWith(entry.path ?? ''))
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0]
  return match?.id
}

export function pathForNavId(id: string): string | undefined {
  return leaves().find((entry) => entry.id === id)?.path
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
  return NAV.find((entry) => entry.id === id || (entry.children ?? []).some((c) => c.id === id))?.id
}

/** Builds what the shell renders. Counts come from the app. */
export function toNavGroups(
  icons: Record<string, React.ReactNode> = {},
  counts: Partial<Record<string, number>> = {},
): ShellNavGroup[] {
  return [
    {
      id: 'main',
      items: NAV.map((entry) => ({
        id: entry.id,
        label: entry.label,
        ...(icons[entry.id] ? { icon: icons[entry.id] } : {}),
        ...(counts[entry.id] !== undefined ? { count: counts[entry.id] } : {}),
        ...(entry.children
          ? {
              items: entry.children.map((child) => ({
                id: child.id,
                label: child.label,
                ...(counts[child.id] !== undefined ? { count: counts[child.id] } : {}),
              })),
            }
          : {}),
      })),
    },
  ]
}
