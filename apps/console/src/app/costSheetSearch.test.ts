import { describe, expect, it } from 'vitest'
import { DEFAULT_COST_SHEET_QUERY, CostSheetStatus } from '@fp/domain'
import { parseCostSheetSearch } from './costSheetSearch'

describe('parseCostSheetSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseCostSheetSearch({})).toEqual(DEFAULT_COST_SHEET_QUERY)
  })

  it('reads a full query', () => {
    expect(parseCostSheetSearch({ page: '2', size: '50', q: 'infra', status: 'archived' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'infra',
      statuses: [CostSheetStatus.Archived],
      sortBy: 'name',
      sortDirection: 'asc',
      view: 'table',
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseCostSheetSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parseCostSheetSearch({ status: 'published,archived' }).statuses).toEqual([
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
    expect(() => parseCostSheetSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseCostSheetSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseCostSheetSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('reads the cards view, and defaults everything else to the table', () => {
    expect(parseCostSheetSearch({ view: 'cards' }).view).toBe('cards')
    expect(parseCostSheetSearch({ view: 'grid' }).view).toBe('table')
    expect(parseCostSheetSearch({}).view).toBe('table')
  })

  it('is stable across a parse of its own output', () => {
    const once = parseCostSheetSearch({ status: ['archived'], sortBy: 'name', sortDirection: 'desc' })
    expect(parseCostSheetSearch({ ...once })).toEqual(once)
  })
})
