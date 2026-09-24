import { describe, expect, it } from 'vitest'
import { SECTION_IDS, navEntryForPath, sectionForPath, toNavGroups } from './navigation'

describe('sectionForPath', () => {
  it.each([
    ['/features', 'catalog'],
    ['/features/new', 'catalog'],
    ['/plans', 'catalog'],
    ['/invoices', 'billing'],
    ['/invoices?page=2', 'billing'],
    ['/customers', 'customers'],
  ])('puts %s in %s', (path, section) => {
    expect(sectionForPath(path)).toBe(section)
  })

  // An unknown path must land somewhere rather than leaving the rail blank.
  it.each(['/', '/nonsense', ''])('falls back to home for %p', (path) => {
    expect(sectionForPath(path)).toBe('home')
  })
})

describe('navEntryForPath', () => {
  it('finds the entry a nested route belongs to', () => {
    expect(navEntryForPath('/features/new')).toBe('features')
  })

  it('returns nothing for a path with no entry', () => {
    expect(navEntryForPath('/nonsense')).toBeUndefined()
  })
})

describe('toNavGroups', () => {
  it('renders no group for a section with no children', () => {
    expect(toNavGroups('home')).toEqual([])
  })

  it('carries counts through when given, and omits them when not', () => {
    const [group] = toNavGroups('catalog', { features: 12 })
    expect(group?.items.find((i) => i.id === 'features')?.count).toBe(12)
    expect(group?.items.find((i) => i.id === 'plans')).not.toHaveProperty('count')
  })

  it('shows a zero count rather than hiding it', () => {
    const [group] = toNavGroups('catalog', { plans: 0 })
    expect(group?.items.find((i) => i.id === 'plans')?.count).toBe(0)
  })

  it('covers every section', () => {
    for (const section of SECTION_IDS) expect(() => toNavGroups(section)).not.toThrow()
  })
})
