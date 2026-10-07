import { describe, expect, it } from 'vitest'
import {
  FOOTER_NAV,
  NAV,
  SECONDARY,
  hrefForNavId,
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
    ['/customers/new', 'customers'],
    ['/customers/cus_1/edit', 'customers'],
    ['/subscriptions', 'subscriptions'],
    ['/coupons', 'settings-discounts'],
    ['/taxes', 'settings-taxes'],
    ['/cost-sheets', 'settings-cost-tracking'],
    ['/pricing-widget', 'pricing-widget'],
  ])('resolves %s to %s', (path, id) => {
    expect(navEntryForPath(path)).toBe(id)
  })

  // Longest match wins: '/' would otherwise match every path.
  it('does not let the root entry swallow every path', () => {
    expect(navEntryForPath('/')).toBe('home')
    expect(navEntryForPath('/features')).not.toBe('home')
  })

  it.each([
    ['?section=team&tab=roles', 'settings'],
    ['?section=invoicing&tab=invoices', 'settings'],
    ['?section=webhooks&tab=webhooks', 'webhooks'],
    ['?section=labels&tab=labels', 'settings-labels'],
    ['?section=api-keys&tab=api-keys', 'settings'],
    ['', 'settings'],
  ])('resolves /settings%s to %s', (search, id) => {
    expect(navEntryForPath('/settings', search)).toBe(id)
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
      'addons',
      'pricing-widget',
    ])
  })

  it('carries counts onto children and top-level rows, and omits them when absent', () => {
    const [group] = toNavGroups({}, { features: 12, customers: 40 })
    const catalog = group?.items.find((item) => item.id === 'catalog')
    expect(catalog?.items?.find((c) => c.id === 'features')?.count).toBe(12)
    expect(catalog?.items?.find((c) => c.id === 'plans')).not.toHaveProperty('count')
    expect(group?.items.find((item) => item.id === 'customers')?.count).toBe(40)
  })

  it('shows a zero count rather than hiding it', () => {
    const [group] = toNavGroups({}, { plans: 0 })
    const catalog = group?.items.find((item) => item.id === 'catalog')
    expect(catalog?.items?.find((c) => c.id === 'plans')?.count).toBe(0)
  })
})

describe('the tree itself', () => {
  it('gives every entry either a path or children, never neither', () => {
    for (const entry of [...NAV, ...FOOTER_NAV]) {
      expect(entry.path ?? entry.children, entry.id).toBeDefined()
    }
  })

  it('every navigable id round-trips to a path', () => {
    for (const entry of [...NAV, ...FOOTER_NAV]) {
      for (const child of entry.children ?? []) expect(pathForNavId(child.id)).toBeDefined()
    }
  })
})

describe('the sidebar layout', () => {
  it('renders the primary tree unlabelled, then a pinned footer with Integrations and Documentation', () => {
    const groups = toNavGroups()
    expect(groups.map((group) => group.id)).toEqual(['main', 'footer'])
    expect(groups[0]?.title).toBeUndefined()
    expect(groups[0]?.pinned).toBeUndefined()
    expect(groups[1]?.pinned).toBe(true)
    expect(groups[1]?.items.map((item) => item.id)).toEqual(['integrations', 'docs'])
  })

  it('lists the top level in the order of the design', () => {
    expect(NAV.map((entry) => entry.label)).toEqual([
      'Home',
      'Customers',
      'Contracts',
      'Billing',
      'Collections',
      'Revenue',
      'Product catalog',
      'Developers',
    ])
    expect(FOOTER_NAV.map((entry) => entry.label)).toEqual(['Integrations', 'Documentation'])
  })

  // Not in the rail, but still real routes: the command palette and the
  // breadcrumb resolve against them.
  it('keeps unlisted pages reachable', () => {
    expect(pathForNavId('docs')).toBe('/docs')
    expect(SECONDARY.map((entry) => entry.id)).toEqual([
      'settings',
      'settings-discounts',
      'settings-taxes',
      'settings-cost-tracking',
      'settings-labels',
      'price-units',
      'groups',
      'api-keys',
      'service-accounts',
    ])
  })

  it('links a Settings tab with the search that selects it', () => {
    expect(hrefForNavId('settings')).toBe('/settings')
    expect(hrefForNavId('webhooks')).toBe('/settings?section=webhooks&tab=webhooks')
    expect(hrefForNavId('plans')).toBe('/plans')
    expect(hrefForNavId('billing')).toBeUndefined()
  })
})

describe('breadcrumbForPath', () => {
  it('names the group before the page', () => {
    expect(breadcrumbForPath('/features')).toEqual([
      { label: 'Product catalog' },
      { label: 'Products' },
    ])
  })

  it('names Settings before a Settings child, wherever the page lives', () => {
    expect(breadcrumbForPath('/coupons')).toEqual([{ label: 'Settings' }, { label: 'Discounts' }])
    expect(breadcrumbForPath('/settings', '?section=team&tab=members')).toEqual([
      { label: 'Settings' },
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
    '/workflows',
    '/exports',
    '/pricing-widget',
    '/integrations',
    '/usage-syncs',
    '/settings',
    '/api-keys',
    '/service-accounts',
    '/webhooks',
  ]

  const destinations = [...NAV, ...FOOTER_NAV, ...SECONDARY].flatMap((entry) => [
    ...(entry.path ? [entry.path] : []),
    ...(entry.children ?? []).map((child) => child.path ?? ''),
  ])
  const hrefs = [...NAV, ...FOOTER_NAV, ...SECONDARY]
    .flatMap((entry) => [entry, ...(entry.children ?? [])])
    .filter((entry) => entry.path)
    .map((entry) => hrefForNavId(entry.id))

  it.each(destinations)('%s has a route', (path) => {
    const routed = BUILT.includes(path) || PLACEHOLDER_ROUTES.some((route) => route.path === path)
    expect(routed, `${path} is in the sidebar but has no route`).toBe(true)
  })

  it('has no placeholder for a page that is already built', () => {
    for (const route of PLACEHOLDER_ROUTES) {
      expect(BUILT, route.path).not.toContain(route.path)
    }
  })

  it('has no duplicate paths', () => {
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
