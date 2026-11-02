import { describe, expect, it } from 'vitest'
import {
  DOCS_URL,
  FOOTER_NAV,
  NAV,
  SECONDARY,
  hrefForNavId,
  breadcrumbForPath,
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
    ['/contracts', 'subscriptions'],
    ['/coupons', 'settings-discounts'],
    ['/taxes', 'settings-taxes'],
    ['/settings/usage-billing', 'settings-usage-billing'],
    ['/billing/checkout/success', 'settings-usage-billing-checkout'],
    ['/cost-sheets', 'settings-cost-tracking'],
    ['/pricing-widget', 'pricing-widget'],
    ['/webhooks', 'webhooks'],
    ['/webhooks/ep_2mVxQ7nB8yL4cZ1kR0aT3sW9', 'webhooks'],
    ['/webhooks/new', 'webhooks'],
  ])('resolves %s to %s', (path, id) => {
    expect(navEntryForPath(path)).toBe(id)
  })

  // Longest match wins: '/' would otherwise match every path.
  it('does not let the root entry swallow every path', () => {
    expect(navEntryForPath('/')).toBe('home')
    expect(navEntryForPath('/features')).not.toBe('home')
  })

  it.each([
    ['?section=team&tab=members', 'settings'],
    ['?section=invoicing&tab=invoices', 'settings'],
    ['?section=tags&tab=tags', 'settings-tags'],

    ['', 'settings'],
  ])('resolves /settings%s to %s', (search, id) => {
    expect(navEntryForPath('/settings', search)).toBe(id)
  })

  it('returns nothing for a path with no entry', () => {
    expect(navEntryForPath('/nonsense')).toBeUndefined()
  })
})

describe('toNavGroups', () => {
  it('nests children under their parent', () => {
    const [group] = toNavGroups()
    const catalog = group?.items.find((item) => item.id === 'catalog')
    expect(catalog?.items?.map((child) => child.id)).toEqual([
      'plans',
      'features',
      'addons',
      'pricing-widget',
    ])
  })

  it('carries no counts onto any row', () => {
    const rows = toNavGroups().flatMap((group) =>
      group.items.flatMap((item) => [item, ...(item.items ?? [])]),
    )
    for (const row of rows) expect(row).not.toHaveProperty('count')
  })
})

describe('the tree itself', () => {
  it('gives every entry a path, a link out, or children, never none', () => {
    for (const entry of [...NAV, ...FOOTER_NAV]) {
      expect(entry.path ?? entry.external ?? entry.children, entry.id).toBeDefined()
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
    // Children of the two money groups, so a reorder cannot quietly move a page.
    expect(NAV.find((entry) => entry.id === 'billing')?.children?.map((c) => c.label)).toEqual([
      'Invoices',
      'Credit memos',
    ])
    expect(NAV.find((entry) => entry.id === 'collections')?.children?.map((c) => c.label)).toEqual([
      'Payments',
    ])
    expect(NAV.map((entry) => entry.label)).toEqual([
      'Home',
      'Customers',
      'Product catalog',
      'Contracts',
      'Billing',
      'Collections',
      'Revenue',
      'Reports',
      'Developers',
    ])
    expect(FOOTER_NAV.map((entry) => entry.label)).toEqual(['Integrations', 'Documentation'])
  })

  // Not in the rail, but still real routes: the command palette and the
  // breadcrumb resolve against them.
  it('keeps unlisted pages reachable', () => {
    expect(pathForNavId('docs')).toBeUndefined()
    expect(hrefForNavId('docs')).toBe(DOCS_URL)
    expect(SECONDARY.map((entry) => entry.id)).toEqual([
      'settings',
      'settings-usage-billing',
      'settings-usage-billing-checkout',
      'settings-discounts',
      'settings-taxes',
      'settings-cost-tracking',
      'settings-tags',
      'price-units',
    ])
  })

  it('links a Settings tab with the search that selects it', () => {
    expect(hrefForNavId('settings')).toBe('/settings')
    expect(hrefForNavId('settings-tags')).toBe('/settings?section=tags&tab=tags')
    expect(hrefForNavId('webhooks')).toBe('/webhooks')
    expect(hrefForNavId('plans')).toBe('/plans')
    expect(hrefForNavId('billing')).toBeUndefined()
  })
})

describe('breadcrumbForPath', () => {
  it('names the group before the page', () => {
    expect(breadcrumbForPath('/features')).toEqual([
      { label: 'Product catalog' },
      { label: 'Features' },
    ])
  })

  it('names Settings before a Settings child, wherever the page lives', () => {
    expect(breadcrumbForPath('/coupons')).toEqual([{ label: 'Settings' }, { label: 'Coupons' }])
    expect(breadcrumbForPath('/settings', '?section=team&tab=members')).toEqual([
      { label: 'Settings' },
    ])
  })

  it('is a single crumb for a top-level destination', () => {
    expect(breadcrumbForPath('/reports')).toEqual([{ label: 'Reports' }])
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
    '/reports',
    '/revenue-recognition',
    '/deferred-rollforward',
    '/unbilled-rollforward',
    '/features',
    '/plans',
    '/addons',
    '/coupons',
    '/price-units',
    '/groups',
    '/cost-sheets',
    '/customers',
    '/contracts',
    '/invoices',
    '/payments',
    '/credit-memos',
    '/taxes',
    '/settings/usage-billing',
    '/billing/checkout',
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
