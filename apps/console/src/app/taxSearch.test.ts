import { describe, expect, it } from 'vitest'
import { DEFAULT_TAX_RATE_QUERY, TaxRateStatus } from '@fp/domain'
import { parseTaxSearch } from './taxSearch'

describe('parseTaxSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseTaxSearch({})).toEqual(DEFAULT_TAX_RATE_QUERY)
  })

  it('reads a full query', () => {
    expect(parseTaxSearch({ page: '2', size: '50', q: 'gst', status: 'archived' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'gst',
      statuses: [TaxRateStatus.Archived],
      sortBy: 'name',
      sortDirection: 'asc',
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseTaxSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parseTaxSearch({ status: 'published,archived' }).statuses).toEqual([
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
    expect(() => parseTaxSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseTaxSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseTaxSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('is stable across a parse of its own output', () => {
    const once = parseTaxSearch({ status: ['archived'], sortBy: 'name', sortDirection: 'desc' })
    expect(parseTaxSearch({ ...once })).toEqual(once)
  })
})
