import { describe, expect, it } from 'vitest'
import { NAV, groupForNavId, navEntryForPath, pathForNavId, toNavGroups } from './navigation'

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
    expect(catalog?.items?.map((child) => child.id)).toEqual(['features', 'plans'])
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
