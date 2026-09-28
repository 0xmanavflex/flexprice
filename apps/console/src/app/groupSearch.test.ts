import { describe, expect, it } from 'vitest'
import { DEFAULT_GROUP_QUERY, GroupStatus } from '@fp/domain'
import { parseGroupSearch } from './groupSearch'

describe('parseGroupSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseGroupSearch({})).toEqual(DEFAULT_GROUP_QUERY)
  })

  it('reads a full query', () => {
    expect(parseGroupSearch({ page: '2', size: '50', q: 'storage', status: 'archived' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'storage',
      statuses: [GroupStatus.Archived],
      sortBy: 'name',
      sortDirection: 'asc',
      view: 'table',
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseGroupSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parseGroupSearch({ status: 'published,archived' }).statuses).toEqual([
      'published',
      'archived',
    ])
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['an unknown status', { status: 'expired' }],
    ['nulls', { page: null, status: null, q: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseGroupSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseGroupSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseGroupSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('reads the cards view, and defaults everything else to the table', () => {
    expect(parseGroupSearch({ view: 'cards' }).view).toBe('cards')
    expect(parseGroupSearch({ view: 'grid' }).view).toBe('table')
    expect(parseGroupSearch({}).view).toBe('table')
  })

  it('is stable across a parse of its own output', () => {
    const once = parseGroupSearch({ status: ['archived'], sortBy: 'name', sortDirection: 'desc' })
    expect(parseGroupSearch({ ...once })).toEqual(once)
  })
})
