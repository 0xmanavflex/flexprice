import { describe, expect, it } from 'vitest'
import {
  NAV,
  SECONDARY,
  breadcrumbForPath,
  groupForNavId,
  navEntryForPath,
  pathForNavId,
  toNavGroups,
} from './navigation'
import { PLACEHOLDER_ROUTES } from '../placeholderRoutes'

describe('navEntryForPath', () => {
  it.each([
    ['/features', 'features'],
    ['/features/new', 'features'],
    ['/invoices', 'invoices'],
    ['/invoices?page=2', 'invoices'],
    ['/customers', 'customers'],
  ])('resolves %s to %s', (path, id) => {
    expect(navEntryForPath(path)).toBe(id)
  })

  // Longest match wins: '/' would otherwise match every path.
  it('does not let the root entry swallow every path', () => {
    expect(navEntryForPath('/')).toBe('home')
    expect(navEntryForPath('/features')).not.toBe('home')
  })

  it('returns nothing for a path with no entry', () => {
    expect(navEntryForPath('/nonsense')).toBeUndefined()
  })
})

describe('groupForNavId', () => {
  it('finds the group a child belongs to', () => {
    expect(groupForNavId('features')).toBe('catalog')
    expect(groupForNavId('invoices')).toBe('billing')
  })

  it('treats a top-level entry as its own group', () => {
    expect(groupForNavId('home')).toBe('home')
  })

  it('handles an unknown id', () => {
    expect(groupForNavId(undefined)).toBeUndefined()
    expect(groupForNavId('nonsense')).toBeUndefined()
  })
})

describe('toNavGroups', () => {
  it('nests children under their parent', () => {
    const [group] = toNavGroups()
    const catalog = group?.items.find((item) => item.id === 'catalog')
    expect(catalog?.items?.map((child) => child.id)).toEqual([
      'features',
      'plans',
      'coupons',
      'addons',
      'cost-sheets',
      'price-units',
      'groups',
    ])
  })

  it('carries counts onto children, and omits them when absent', () => {
    const [group] = toNavGroups({}, { features: 12 })
    const catalog = group?.items.find((item) => item.id === 'catalog')
    expect(catalog?.items?.find((c) => c.id === 'features')?.count).toBe(12)
    expect(catalog?.items?.find((c) => c.id === 'plans')).not.toHaveProperty('count')
  })

  it('shows a zero count rather than hiding it', () => {
    const [group] = toNavGroups({}, { plans: 0 })
    const catalog = group?.items.find((item) => item.id === 'catalog')
    expect(catalog?.items?.find((c) => c.id === 'plans')?.count).toBe(0)
  })
})

describe('the tree itself', () => {
  it('gives every entry either a path or children, never neither', () => {
    for (const entry of NAV) {
      expect(entry.path ?? entry.children, entry.id).toBeDefined()
    }
  })

  it('every navigable id round-trips to a path', () => {
    for (const entry of NAV) {
      for (const child of entry.children ?? []) expect(pathForNavId(child.id)).toBeDefined()
    }
  })
})

describe('the secondary destinations', () => {
  // The "Quick links" group is gone: Settings and Documentation moved to the
  // footer account menu, so the sidebar renders only the primary tree now.
  it('renders a single unlabelled primary group, with no Quick links group', () => {
    const groups = toNavGroups()
    expect(groups).toHaveLength(1)
    // The lone primary tree carries no heading — no "Workspace" label over the
    // only section on screen.
    expect(groups[0]?.title).toBeUndefined()
    expect(groups.some((group) => group.title === 'Quick links')).toBe(false)
    expect(groups.some((group) => group.collapsible)).toBe(false)
  })

  // Kept out of the sidebar, but still real routes — the account menu and the
  // breadcrumb resolve against them.
  it('still resolves Settings and Documentation as routes', () => {
    expect(pathForNavId('settings')).toBe('/settings')
    expect(pathForNavId('docs')).toBe('/docs')
    expect(SECONDARY.map((entry) => entry.id)).toEqual(['settings', 'docs'])
  })

  it('keeps the primary tree at twenty-four destinations', () => {
    const count = NAV.reduce(
      (total, entry) => total + (entry.path ? 1 : 0) + (entry.children?.length ?? 0),
      0,
    )
    expect(count).toBe(24)
  })
})

describe('breadcrumbForPath', () => {
  it('names the group before the page', () => {
    expect(breadcrumbForPath('/features')).toEqual([
      { label: 'Product Catalog' },
      { label: 'Features' },
    ])
  })

  it('is a single crumb for a top-level destination', () => {
    expect(breadcrumbForPath('/revenue')).toEqual([{ label: 'Revenue' }])
  })

  // A crumb that navigates somewhere the user did not name is worse than one
  // that does nothing, and a group has no page of its own.
  it('makes no crumb navigable', () => {
    for (const crumb of breadcrumbForPath('/invoices')) {
      expect(crumb.onClick).toBeUndefined()
    }
  })

  it('is empty where there is no entry', () => {
    expect(breadcrumbForPath('/nonsense')).toEqual([])
  })
})

/**
 * The defect this guards against was visible on screen: twenty of twenty-four
 * sidebar items navigated to a bare "Not Found", because the navigation tree
 * and the route table were maintained separately and drifted.
 */
describe('every destination resolves', () => {
  const BUILT = [
    '/',
    '/revenue',
    '/features',
    '/plans',
    '/addons',
    '/coupons',
    '/price-units',
    '/groups',
    '/cost-sheets',
    '/customers',
    '/subscriptions',
    '/invoices',
    '/payments',
    '/credit-notes',
    '/taxes',
    '/events',
    '/settings',
    '/api-keys',
    '/service-accounts',
    '/webhooks',
  ]

  const destinations = [...NAV, ...SECONDARY].flatMap((entry) => [
    ...(entry.path ? [entry.path] : []),
    ...(entry.children ?? []).map((child) => child.path ?? ''),
  ])

  it.each(destinations)('%s has a route', (path) => {
    const routed =
      BUILT.includes(path) || PLACEHOLDER_ROUTES.some((route) => route.path === path)
    expect(routed, `${path} is in the sidebar but has no route`).toBe(true)
  })

  it('has no placeholder for a page that is already built', () => {
    for (const route of PLACEHOLDER_ROUTES) {
      expect(BUILT, route.path).not.toContain(route.path)
    }
  })

  it('has no duplicate paths', () => {
    expect(new Set(destinations).size).toBe(destinations.length)
  })
})
