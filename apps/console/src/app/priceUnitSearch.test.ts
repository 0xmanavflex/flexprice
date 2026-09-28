import { describe, expect, it } from 'vitest'
import { DEFAULT_PRICE_UNIT_QUERY, PriceUnitStatus } from '@fp/domain'
import { parsePriceUnitSearch } from './priceUnitSearch'

describe('parsePriceUnitSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parsePriceUnitSearch({})).toEqual(DEFAULT_PRICE_UNIT_QUERY)
  })

  it('reads a full query', () => {
    expect(parsePriceUnitSearch({ page: '2', size: '50', q: 'credits', status: 'archived' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'credits',
      statuses: [PriceUnitStatus.Archived],
      sortBy: 'name',
      sortDirection: 'asc',
      view: 'table',
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parsePriceUnitSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parsePriceUnitSearch({ status: 'published,archived' }).statuses).toEqual([
      'published',
      'archived',
    ])
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['an unknown status', { status: 'deleted' }],
    ['nulls', { page: null, status: null, q: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parsePriceUnitSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parsePriceUnitSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parsePriceUnitSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('reads the cards view, and defaults everything else to the table', () => {
    expect(parsePriceUnitSearch({ view: 'cards' }).view).toBe('cards')
    expect(parsePriceUnitSearch({ view: 'grid' }).view).toBe('table')
    expect(parsePriceUnitSearch({}).view).toBe('table')
  })

  it('reads the code sort field', () => {
    expect(parsePriceUnitSearch({ sort: 'code' }).sortBy).toBe('code')
  })

  it('is stable across a parse of its own output', () => {
    const once = parsePriceUnitSearch({ status: ['archived'], sortBy: 'code', sortDirection: 'desc' })
    expect(parsePriceUnitSearch({ ...once })).toEqual(once)
  })
})
