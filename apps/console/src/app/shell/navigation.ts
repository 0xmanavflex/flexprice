import type { ShellNavGroup, ShellSection } from '@fp/ui/compositions'

/**
 * The navigation, ordered by how often a finance person needs it.
 *
 * Catalog is fourth here and first to be built, because customers, billing and
 * usage all reference it. Navigation order and build order are different
 * things, and conflating them is how a product ends up with a menu sorted by
 * engineering convenience.
 *
 * Icons are supplied by the app rather than declared here, so this module stays
 * free of JSX and can be unit-tested as data.
 */
export const SECTION_IDS = ['home', 'customers', 'billing', 'catalog', 'usage', 'settings'] as const
export type SectionId = (typeof SECTION_IDS)[number]

export const SECTION_LABEL: Record<SectionId, string> = {
  home: 'Home',
  customers: 'Customers',
  billing: 'Billing',
  catalog: 'Catalog',
  usage: 'Usage',
  settings: 'Settings',
}

/** Sub-navigation per section. `path` is the route it goes to. */
export interface NavEntry {
  id: string
  label: string
  path: string
}

export const SECTION_NAV: Record<SectionId, NavEntry[]> = {
  home: [],
  customers: [
    { id: 'customers', label: 'Customers', path: '/customers' },
    { id: 'subscriptions', label: 'Subscriptions', path: '/subscriptions' },
  ],
  billing: [{ id: 'invoices', label: 'Invoices', path: '/invoices' }],
  catalog: [
    { id: 'features', label: 'Features', path: '/features' },
    { id: 'plans', label: 'Plans', path: '/plans' },
  ],
  usage: [],
  settings: [],
}

/** Which section a path belongs to. Drives the rail without duplicating routes. */
export function sectionForPath(pathname: string): SectionId {
  for (const section of SECTION_IDS) {
    if (SECTION_NAV[section].some((entry) => pathname.startsWith(entry.path))) return section
  }
  return 'home'
}

export function navEntryForPath(pathname: string): string | undefined {
  for (const section of SECTION_IDS) {
    const match = SECTION_NAV[section].find((entry) => pathname.startsWith(entry.path))
    if (match) return match.id
  }
  return undefined
}

/** Counts come from the app; the shape is built here. */
export function toNavGroups(
  section: SectionId,
  counts: Partial<Record<string, number>> = {},
): ShellNavGroup[] {
  const items = SECTION_NAV[section]
  if (items.length === 0) return []
  return [
    {
      id: section,
      items: items.map((entry) => ({
        id: entry.id,
        label: entry.label,
        ...(counts[entry.id] !== undefined ? { count: counts[entry.id] } : {}),
      })),
    },
  ]
}

export type { ShellSection }
