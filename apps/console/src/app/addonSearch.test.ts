import { describe, expect, it } from 'vitest'
import { DEFAULT_ADDON_QUERY, AddonStatus } from '@fp/domain'
import { parseAddonSearch } from './addonSearch'

describe('parseAddonSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseAddonSearch({})).toEqual(DEFAULT_ADDON_QUERY)
  })

  it('reads a full query', () => {
    expect(parseAddonSearch({ page: '2', size: '50', q: 'seats', status: 'archived' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'seats',
      statuses: [AddonStatus.Archived],
      sortBy: 'name',
      sortDirection: 'asc',
      view: 'table',
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseAddonSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parseAddonSearch({ status: 'published,archived' }).statuses).toEqual([
      'published',
      'archived',
    ])
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['an unknown status', { status: 'live' }],
    ['nulls', { page: null, status: null, q: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseAddonSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseAddonSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseAddonSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('reads the cards view, and defaults everything else to the table', () => {
    expect(parseAddonSearch({ view: 'cards' }).view).toBe('cards')
    expect(parseAddonSearch({ view: 'grid' }).view).toBe('table')
    expect(parseAddonSearch({}).view).toBe('table')
  })

  it('is stable across a parse of its own output', () => {
    const once = parseAddonSearch({ status: ['archived'], sortBy: 'name', sortDirection: 'desc' })
    expect(parseAddonSearch({ ...once })).toEqual(once)
  })
})
