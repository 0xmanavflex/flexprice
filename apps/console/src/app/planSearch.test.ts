import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAN_QUERY, PlanStatus } from '@fp/domain'
import { parsePlanSearch } from './planSearch'

describe('parsePlanSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parsePlanSearch({})).toEqual(DEFAULT_PLAN_QUERY)
  })

  it('reads a full query', () => {
    expect(parsePlanSearch({ page: '2', size: '50', q: 'pro', status: 'archived' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'pro',
      statuses: [PlanStatus.Archived],
      sortBy: DEFAULT_PLAN_QUERY.sortBy,
      sortDirection: DEFAULT_PLAN_QUERY.sortDirection,
      view: 'table',
      filters: [],
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parsePlanSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parsePlanSearch({ status: 'published,archived' }).statuses).toEqual([
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
    expect(() => parsePlanSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parsePlanSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parsePlanSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('reads the cards view, and defaults everything else to the table', () => {
    expect(parsePlanSearch({ view: 'cards' }).view).toBe('cards')
    expect(parsePlanSearch({ view: 'grid' }).view).toBe('table')
    expect(parsePlanSearch({}).view).toBe('table')
  })

  // Parsing its own output must be a fixed point, or a reload changes the list.
  it('is stable across a parse of its own output', () => {
    const once = parsePlanSearch({ status: ['archived'], sortBy: 'name', sortDirection: 'desc' })
    expect(parsePlanSearch({ ...once })).toEqual(once)
  })
})
