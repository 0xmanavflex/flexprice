import { describe, expect, it } from 'vitest'
import { DEFAULT_SUBSCRIPTION_QUERY, SubscriptionStatus } from '@fp/domain'
import { parseSubscriptionSearch } from './subscriptionSearch'

describe('parseSubscriptionSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseSubscriptionSearch({})).toEqual(DEFAULT_SUBSCRIPTION_QUERY)
  })

  it('reads a full query', () => {
    expect(
      parseSubscriptionSearch({ page: '2', size: '50', q: 'acme', status: 'paused', dir: 'asc' }),
    ).toEqual({
      page: 2,
      pageSize: 50,
      search: 'acme',
      statuses: [SubscriptionStatus.Paused],
      sortBy: DEFAULT_SUBSCRIPTION_QUERY.sortBy,
      sortDirection: 'asc',
      filters: DEFAULT_SUBSCRIPTION_QUERY.filters,
    })
  })

  it('opens on Active and Trialing, and keeps a cleared filter cleared', () => {
    expect(parseSubscriptionSearch({}).filters).toEqual([
      { field: 'subscription_status', op: 'in', value: ['active', 'trialing'] },
    ])
    expect(parseSubscriptionSearch({ filters: [] }).filters).toEqual([])
    expect(parseSubscriptionSearch({ filters: '[]' }).filters).toEqual([])
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseSubscriptionSearch({ status: ['active', 'cancelled'] }).statuses).toEqual([
      'active',
      'cancelled',
    ])
    expect(parseSubscriptionSearch({ status: 'active,cancelled' }).statuses).toEqual([
      'active',
      'cancelled',
    ])
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['an unknown status', { status: 'expired' }],
    ['nulls', { page: null, status: null, q: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseSubscriptionSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseSubscriptionSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseSubscriptionSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('defaults the sort to most recently changed first, and reads ascending', () => {
    expect(parseSubscriptionSearch({}).sortBy).toBe('updatedAt')
    expect(parseSubscriptionSearch({}).sortDirection).toBe('desc')
    expect(parseSubscriptionSearch({ sort: 'startDate' }).sortBy).toBe('startDate')
    expect(parseSubscriptionSearch({ sort: 'nonsense' }).sortBy).toBe('updatedAt')
    expect(parseSubscriptionSearch({ dir: 'asc' }).sortDirection).toBe('asc')
  })

  it('is stable across a parse of its own output', () => {
    const once = parseSubscriptionSearch({
      status: ['paused'],
      sortBy: 'createdAt',
      sortDirection: 'asc',
    })
    expect(parseSubscriptionSearch({ ...once })).toEqual(once)
  })
})
