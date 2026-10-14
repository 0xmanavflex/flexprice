import { describe, expect, it } from 'vitest'
import { DEFAULT_COUPON_QUERY, CouponStatus } from '@fp/domain'
import { parseCouponSearch } from './couponSearch'

describe('parseCouponSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseCouponSearch({})).toEqual(DEFAULT_COUPON_QUERY)
  })

  it('reads a full query', () => {
    expect(parseCouponSearch({ page: '2', size: '50', q: 'launch', status: 'archived' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'launch',
      statuses: [CouponStatus.Archived],
      sortBy: 'name',
      sortDirection: 'asc',
      view: 'table',
      filters: [],
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseCouponSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parseCouponSearch({ status: 'published,archived' }).statuses).toEqual([
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
    expect(() => parseCouponSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseCouponSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseCouponSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('reads the cards view, and defaults everything else to the table', () => {
    expect(parseCouponSearch({ view: 'cards' }).view).toBe('cards')
    expect(parseCouponSearch({ view: 'grid' }).view).toBe('table')
    expect(parseCouponSearch({}).view).toBe('table')
  })

  it('is stable across a parse of its own output', () => {
    const once = parseCouponSearch({ status: ['archived'], sortBy: 'name', sortDirection: 'desc' })
    expect(parseCouponSearch({ ...once })).toEqual(once)
  })
})
